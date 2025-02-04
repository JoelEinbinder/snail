import collections.abc
import sys
import keyword
import os
import re
import collections
import math
from contextlib import contextmanager,redirect_stderr,redirect_stdout
from os import devnull

remote_objects = dict()
last_object_id = 0

# https://stackoverflow.com/questions/11130156/suppress-stdout-stderr-print-from-python-functions
@contextmanager
def suppress_stdout_stderr():
    """A context manager that redirects stdout and stderr to devnull"""
    with open(devnull, 'w') as fnull:
        with redirect_stderr(fnull) as err, redirect_stdout(fnull) as out:
            yield (err, out)

def value_to_cdp_type(value):
    if isinstance(value, str):
      return 'string'
    if isinstance(value, int):
      return 'number'
    if isinstance(value, float):
      return 'number'
    if value is None:
      return 'undefined'
    return 'object'

def to_remote_object(value):
    if isinstance(value, str):
      return {'type': 'string', 'value': value}
    if isinstance(value, int):
      return {'type': 'number', 'value': value}
    if isinstance(value, float):
      if math.isnan(value):
        return {'type': 'number', 'unserializableValue': 'NaN', 'description': repr(value)}
      if math.isinf(value):
        return {'type': 'number', 'unserializableValue': 'Infinity' if value > 0 else '-Infinity', 'description': repr(value)}
      return {'type': 'number', 'value': value, 'description': repr(value)}
    if value is None:
      return {'type': 'undefined', 'value': value, 'description': 'None'}
    global last_object_id
    id = last_object_id + 1
    last_object_id = id
    full_id = 'py-{}'.format(id)
    remote_objects[full_id] = value
    return {
      'type': remote_object_type(value),
      'objectId': full_id,
      'description': repr(value),
      'className': value.__class__.__name__,
      'preview': None if callable(value) else remote_object_preview(value),
      'subtype': remote_object_subtype(value),
    }

def remote_object_subtype(obj):
  if isinstance(obj, collections.abc.Mapping):
    return 'map'
  if isinstance(obj, tuple):
    return 'tuple'
  if isinstance(obj, collections.abc.Sequence):
    return 'array'
  if isinstance(obj, collections.abc.Set):
    return 'set'
  return None

def remote_object_type(obj):
  if isinstance(obj, str):
    return 'string'
  if isinstance(obj, int):
    return 'number'
  if isinstance(obj, float):
    return 'number'
  if obj is None:
    return 'undefined'
  if callable(obj):
    return 'function'
  return 'object'

def remote_object_preview(obj):
  properties = []
  overflow = False
  if isinstance(obj, collections.abc.Mapping):
    for key, value in obj.items():
      if len(properties) >= 3:
        overflow = True
        break
      properties.append({
        'name': str(key),
        'value': str(value),
        'type': value_to_cdp_type(value),
      })
  elif isinstance(obj, collections.abc.Sequence) or isinstance(obj, collections.abc.Set):
    for i, value in enumerate(obj):
      if len(properties) >= 3:
        overflow = True
        break
      properties.append({
        'name': str(i),
        'value': str(value),
        'type': value_to_cdp_type(value),
      })
  return {
    'type': remote_object_type(obj) ,
    'subtype': remote_object_subtype(obj),
    'description': repr(obj),
    'properties': properties,
    'overflow': overflow,
  }
internal_globals = {}
def convert_print_to_console(callback):
  original_print = print
  def internal_print(*args, **kwargs):
    if kwargs:
      return original_print(*args, **kwargs)
    callback({'method': 'Runtime.consoleAPICalled', 'params': {'type': 'log', 'args': list(map(to_remote_object, args)) }})
  internal_globals["print"] = internal_print

# add modules to path
dirname = os.path.dirname(__file__)
sys.path.append(os.path.join(dirname, 'modules'))

def cdp_handler(method, params):
  if method == 'Python.threadStdio':
    sys.stdout.flush()
    sys.stderr.write(params['text'])
    sys.stderr.flush()
  elif method == 'Runtime.evaluate':
    import_before = sys.path[0]
    sys.path[0] = os.getcwd()
    if '_snail_plt_backend' in sys.modules:
      sys.modules['_snail_plt_backend'].newCommandStarted()
    try:
      try:
        mode = 'eval'
        compiled = compile(params['expression'], '<string>', 'eval')
      except:
        mode = 'exec'
        compiled = compile(params['expression'], '<string>', 'exec')
      value = (eval if mode == 'eval' else exec)(compiled, internal_globals)
      result = {'result': to_remote_object(value)}
    except Exception as error:
      result = {'exceptionDetails': {'exception': to_remote_object(error)}}
    if '_snail_plt_backend' in sys.modules:
      sys.modules['_snail_plt_backend'].commandFinished()
    sys.path[0] = import_before
    return result
  elif method == 'Runtime.getProperties':
    with suppress_stdout_stderr():
      properties = []
      obj = remote_objects[params['objectId']]
      try:
        if isinstance(obj, collections.abc.Mapping):
          for key, value in obj.items():
            properties.append({
              'name': str(key),
              'value': to_remote_object(value)
            })
        elif isinstance(obj, collections.abc.Sequence) or isinstance(obj, collections.abc.Set):
          for i, value in enumerate(obj):
            properties.append({
              'name': str(i),
              'value': to_remote_object(value)
            })
        else:
          proto = obj.__base__ if hasattr(obj, '__base__') else obj.__class__ if hasattr(obj, '__class__') else None
          for key in dir(obj):
            # loading the properties might throw
            try:
              if key != '__base__' and key != '__class__':
                if proto and hasattr(proto, key) and getattr(obj, key) == getattr(proto, key) and getattr(obj, key) != proto:
                  continue
              properties.append({
                'name': key,
                'value': to_remote_object(getattr(obj, key))
              })
            except:
              pass
      except:
        pass
    return {'result': properties}
  elif method == 'Python.autocomplete':
    with suppress_stdout_stderr():
      line = params['line']
      textToTokenize = line + 'JOEL_AUTOCOMPLETE_MAGIC'
      linesToTokenize = textToTokenize.split('\n')
      linesToTokenize.reverse()
      import tokenize
      tokens = tokenize.generate_tokens(lambda: linesToTokenize.pop() + '\n' if linesToTokenize else '')
      prefix_start = 0
      anchor = 0
      can_complete = True
      last_token = None
      found_magic = False
      import_complete = False
      prefix_end = 0
      try:
        for token in tokens:
          if import_complete:
            can_complete = False
            break
          if token.exact_type == tokenize.NAME:
            if last_token and last_token.exact_type == tokenize.NAME:
              if last_token.string == 'import':
                import_complete = True
              else:
                can_complete = False
            if 'JOEL_AUTOCOMPLETE_MAGIC' in token.string:
              found_magic = True
              anchor = token.start[1]
              break
          elif token.exact_type == tokenize.DOT:
            prefix_end = token.end[1] - 1
          elif token.type == tokenize.OP:
            can_complete = True
            prefix_start = token.end[1]
          elif token.type == tokenize.INDENT or token.type == tokenize.STRING or token.type == tokenize.NUMBER:
            pass
          else:
            can_complete = False
          last_token = token
      except:
        pass
      if not found_magic or not can_complete:
        return { 'suggestions': [], 'anchor': 0 }
      elif import_complete:
        import pkgutil
        suggestions = list()
        seen = set()
        for module in sys.modules:
          if module in seen:
            continue
          seen.add(module)
          value = sys.modules[module]
          if hasattr(value, '__doc__') and value.__doc__:
            suggestions.append({"text": module, "description": value.__doc__})
          else:
            suggestions.append({"text": module})
        
        import_before = sys.path[0]
        sys.path[0] = os.getcwd()
        for module in pkgutil.iter_modules():
          if module.name not in seen:
            suggestions.append({"text": module.name})
            seen.add(module.name)
        sys.path[0] = import_before
        return {
          'suggestions': suggestions,
          'anchor': anchor
        }
      else:
        seen = set()
        suggestions = list()
        def add_suggestion(key, value):
          if key in seen:
            return
          seen.add(key)
          if value_to_cdp_type(value) == 'object' and hasattr(value, '__doc__') and value.__doc__:
            suggestions.append({"text": key,"description": str(value.__doc__)})
          else:
            suggestions.append({"text": key})
        prefix = line[prefix_start:prefix_end]
        if (prefix == ''):
          for key, value in __builtins__.items():
            add_suggestion(key, value)
          g = eval('globals()', internal_globals)
          for key in g:
            add_suggestion(key, g[key])
          for key in keyword.kwlist:
            add_suggestion(key, None)
        else:
          try:
            obj = eval(prefix, internal_globals)
            for key in dir(obj):
              try: # some object values might throw
                add_suggestion(key, getattr(obj, key))
              except:
                pass
          except:
            pass
      return {
        'suggestions': suggestions,
        'anchor': anchor
      }
  elif method == 'Python.isUnexpectedEndOfInput':
    code = params['code']
    lines = code.split('\n')
    try:
      compile(code, '<string>', 'exec')
    except Exception as error:
      if error.lineno == len(lines) and error.offset == len(lines[-1]) + 1:
        if error.msg.startswith('unexpected EOF while parsing') or error.msg.startswith('expected an indented block'):
          return True
    return False
  elif method == 'Python.updateFromOtherLanguage':
    method = params['method']
    params = params['params']
    if method == 'cwd':
      os.chdir(params)
    elif method == 'env':
      for key, value in params.items():
        os.environ[key] = value
  elif method == 'Shell.previewExpression':
    internal_globals['log_me'] = method
    if not re.match(r'^[\.A-Za-z0-9_\s\+\-\/\*\'\"\{\}\[\]\:]*$', params['expression']):
      return None
    try:
      compile(params['expression'], '<string>', 'eval')
    except:
      return None
    with suppress_stdout_stderr():
      evaluation_result = cdp_handler('Runtime.evaluate', {'expression': params['expression']})
    if 'exceptionDetails' in evaluation_result:
      return None
    return evaluation_result['result']
  elif method == 'Shell.enable':
    # we only get here in REPL mode
    # set the env
    for key,value in params['env'].items():
      os.environ[key] = value
    return None
  else:
    raise Exception('Unknown method ' + method)
