import sys
import json
import io
import keyword
import os

remote_objects = dict()
last_object_id = 0

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
  if isinstance(obj, dict):
    return 'map'
  if isinstance(obj, list):
    return 'array'
  if isinstance(obj, set):
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
  if isinstance(obj, dict):
    for key, value in obj.items():
      if len(properties) >= 3:
        overflow = True
        break
      properties.append({
        'name': key,
        'value': str(value),
        'type': value_to_cdp_type(value),
      })
  elif isinstance(obj, list) or isinstance(obj, set):
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
# listen for lines on stdio[3]
connection = io.FileIO(3, 'r+')
internal_globals = {}
original_print = print
def internal_print(*args, **kwargs):
  if kwargs:
    return original_print(*args, **kwargs)
  connection.write(bytes(json.dumps({'method': 'Runtime.consoleAPICalled', 'params': {'type': 'log', 'args': list(map(to_remote_object, args)) }}) + '\n', 'utf-8'))
internal_globals["print"] = internal_print

# add modules to path
dirname = os.path.dirname(__file__)
sys.path.append(os.path.join(dirname, 'modules'))

while True:
  line = connection.readline()
  if not line:
      break
  j = json.loads(line)
  result = None
  try:
    if j['method'] == 'Python.threadStdio':
      import sys
      sys.stdout.flush()
      sys.stderr.write(j['params']['text'])
      sys.stderr.flush()
    elif j['method'] == 'Runtime.evaluate':
      import_before = sys.path[0]
      sys.path[0] = os.getcwd()
      if '_snail_plt_backend' in sys.modules:
        sys.modules['_snail_plt_backend'].newCommandStarted()
      try:
        try:
          mode = 'eval'
          compiled = compile(j['params']['expression'], '<string>', 'eval')
        except:
          mode = 'exec'
          compiled = compile(j['params']['expression'], '<string>', 'exec')
        value = (eval if mode == 'eval' else exec)(j['params']['expression'], internal_globals)
        result = {'result': to_remote_object(value)} if mode == 'eval' else {'result': {'type': 'string', 'value': 'this is the secret secret string:0'}}
      except Exception as error:
        result = {'exceptionDetails': {'exception': to_remote_object(error)}}
      if '_snail_plt_backend' in sys.modules:
        sys.modules['_snail_plt_backend'].commandFinished()
      sys.path[0] = import_before
    elif j['method'] == 'Runtime.getProperties':
      properties = []
      obj = remote_objects[j['params']['objectId']]
      try:
        if isinstance(obj, dict):
          for key, value in obj.items():
            properties.append({
              'name': key,
              'value': to_remote_object(value)
            })
        elif isinstance(obj, list) or isinstance(obj, set):
          for i, value in enumerate(obj):
            properties.append({
              'name': str(i),
              'value': to_remote_object(value)
            })
        else:
          proto = obj.__base__ if hasattr(obj, '__base__') else obj.__class__ if hasattr(obj, '__class__') else None
          for key in dir(obj):
            if proto and hasattr(proto, key) and getattr(obj, key) == getattr(proto, key) and getattr(obj, key) != proto:
              continue
            properties.append({
              'name': key,
              'value': to_remote_object(getattr(obj, key))
            })
      except:
        pass
      result = {'result': properties}
    elif j['method'] == 'Python.autocomplete':
      line = j['params']['line']
      textToTokenize = line + 'JOEL_AUTOCOMPLETE_MAGIC'
      linesToTokenize = textToTokenize.split('\n')
      linesToTokenize.reverse()
      tokenized = False
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
          elif token.type == tokenize.INDENT:
            pass
          else:
            can_complete = False
          last_token = token
      except:
        pass
      if not found_magic or not can_complete:
        result = { 'suggestions': [], 'anchor': 0 }
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
        result = {
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
            suggestions.append({"text": key,"description": value.__doc__})
          else:
            suggestions.append({"text": key})
        prefix = line[prefix_start:prefix_end]
        if (prefix == ''):
          for key in dir(__builtins__):
            add_suggestion(key, getattr(__builtins__, key))
          g = eval('globals()', internal_globals)
          for key in g:
            add_suggestion(key, g[key])
          for key in keyword.kwlist:
            add_suggestion(key, None)
        else:
          try:
            obj = eval(prefix, internal_globals)
            for key in dir(obj):
              add_suggestion(key, getattr(obj, key))
          except:
            pass
        result = {
          'suggestions': suggestions,
          'anchor': anchor
        }
    elif j['method'] == 'Python.isUnexpectedEndOfInput':
      result = False
      code = j['params']['code']
      lines = code.split('\n')
      try:
        compile(code, '<string>', 'exec')
      except Exception as error:
        if error.lineno == len(lines) and error.offset == len(lines[-1]) + 1:
          if error.msg == 'unexpected EOF while parsing' or error.msg == 'expected an indented block':
            result = True
    elif j['method'] == 'Python.updateFromOtherLanguage':
      method = j['params']['method']
      params = j['params']['params']
      if method == 'cwd':
        os.chdir(params)
      elif method == 'env':
        for key, value in params.items():
          os.environ[key] = value
    else:
      raise Exception('Unknown method ' + j['method'])
    if 'id' in j:
      connection.write(bytes(json.dumps({'result': result, 'id': j['id']}) + '\n', 'utf-8'))
  except Exception as error:
    if 'id' in j:
      connection.write(bytes(json.dumps({'error': {"message": str(error)}, 'id': j['id']}) + '\n', 'utf-8'))
