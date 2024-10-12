import json
import io
from cdp_handler import cdp_handler, convert_print_to_console

def handle_json_line(line):
  j = json.loads(line)
  return json.dumps(cdp_handler(j['method'], j['params']))
