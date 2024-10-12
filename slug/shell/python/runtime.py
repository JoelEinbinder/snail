import json
import io
from cdp_handler import cdp_handler, convert_print_to_console
import termios
import fcntl
import sys
fcntl.ioctl(sys.stdout.fileno(), termios.TIOCSCTTY, 0)

connection = io.FileIO(3, 'r+')
convert_print_to_console(lambda message: connection.write(bytes(json.dumps(message) + '\n', 'utf-8')))

while True:
  line = connection.readline()
  if not line:
      break
  j = json.loads(line)
  try:
    result = cdp_handler(j['method'], j['params'])
    if 'id' in j:
      connection.write(bytes(json.dumps({'result': result, 'id': j['id']}) + '\n', 'utf-8'))
  except Exception as error:
    if 'id' in j:
      connection.write(bytes(json.dumps({'error': {"message": str(error)}, 'id': j['id']}) + '\n', 'utf-8'))
