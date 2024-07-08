import sys
import json
import io
import keyword

remote_objects = dict()
last_object_id = 0

def value_to_cdp_type(value):
    if isinstance(value, str):
      return 'string'
    # check if obj is int
    if isinstance(value, int):
      return 'number'
    # check if obj is float
    if isinstance(value, float):
      return 'number'
    # check if obj is None
    if value is None:
      return 'undefined'
    return 'object'

def to_remote_object(value):
   # check if obj is str
    if isinstance(value, str):
      return {'type': 'string', 'value': value}
    # check if obj is int
    if isinstance(value, int):
      return {'type': 'number', 'value': value}
    # check if obj is float
    if isinstance(value, float):
      return {'type': 'number', 'value': value, 'description': str(value)}
    # check if obj is None
    if value is None:
      return {'type': 'undefined', 'value': value, 'description': 'None'}
    global last_object_id
    id = last_object_id + 1
    last_object_id = id
    full_id = 'py-{}'.format(id)
    remote_objects[full_id] = value
    return {
      'type': 'object',
      'objectId': full_id,
      'description': str(value),
      'className': value.__class__.__name__,
      'preview': remote_object_preview(value),
      'subtype': remote_object_subtype(value),
    }

def remote_object_subtype(obj):
  if isinstance(obj, dict):
    return 'map'
  if isinstance(obj, list):
    return 'array'
  return None

def remote_object_preview(obj):
  properties = []
  overflow = False
  if isinstance(obj, dict):
    for key, value in obj.items():
      properties.append({
        'name': key,
        'value': str(value),
        'type': value_to_cdp_type(value),
      })
      if len(properties) >= 3:
        overflow = True
        break
  elif isinstance(obj, list):
    for i, value in enumerate(obj):
      properties.append({
        'name': str(i),
        'value': str(value),
        'type': value_to_cdp_type(value),
      })
      if len(properties) >= 3:
        overflow = True
        break
  return {
    'type': 'object',
    'subtype': remote_object_subtype(obj),
    'description': str(obj),
    'properties': properties,
    'overflow': overflow,
  }
# listen for lines on stdio[3]
connection = io.FileIO(3, 'r+')
while True:
  line = connection.readline()
  if not line:
      break
  j = json.loads(line)
  result = None
  if j['method'] == 'Runtime.evaluate':
    try:
      try:
        mode = 'eval'
        compiled = compile(j['params']['expression'], '<string>', 'eval')
      except:
        mode = 'exec'
        compiled = compile(j['params']['expression'], '<string>', 'exec')
      value = (eval if mode == 'eval' else exec)(j['params']['expression'])
      obj = to_remote_object(value)
      result = {'result': obj}
    except Exception as error:
      result = {'exceptionDetails': {'exception': to_remote_object(str(error))}}
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
      elif isinstance(obj, list):
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
      elif token.exact_type == tokenize.COLON:
        can_complete = True
        prefix_start = token.end[1]
      else:
        can_complete = False
      last_token = token
    print({
      'found_magic': found_magic,
      'can_complete': can_complete,
      'anchor': anchor,
      'prefix_start': prefix_start,
      'prefix': line[prefix_start:prefix_end]
    })
    if not found_magic or not can_complete:
      result = { 'suggestions': [], 'anchor': 0 }
    elif import_complete:
      import pkgutil
      suggestions = list()
      for module in pkgutil.iter_modules():
        suggestions.append(module.name)
      for module in sys.modules:
        if module not in suggestions:
          suggestions.append(module)
      result = {
        'suggestions': suggestions,
        'anchor': anchor
      }
    else:
      suggestions = list()
      prefix = line[prefix_start:prefix_end]
      if (prefix == ''):
        for key in dir(__builtins__):
          suggestions.append(key)
        for key in globals():
          suggestions.append(key)
        for key in keyword.kwlist:
          suggestions.append(key)
      else:
        try:
          obj = eval(prefix)
          for key in dir(obj):
            suggestions.append(key)
        except:
          pass
      result = {
        'suggestions': suggestions,
        'anchor': anchor
      }
  if j['id']:
    connection.write(bytes(json.dumps({'result': result, 'id': j['id']}) + '\n', 'utf-8'))
