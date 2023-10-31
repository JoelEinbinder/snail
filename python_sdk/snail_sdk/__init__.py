import json
def display(filePath):
    print('\x1b\x1aL' + str(filePath) + '\x00', end='')

def set_progress(progress, left_text=None, right_text=None):
    print('\x1b\x1a\x4e' + json.dumps({
        'progress': progress,
        'leftText': left_text,
        'rightText': right_text
    }) + '\x00', end='')

def chart(data):
    print('\x1b\x1aC' + json.dumps(data) + '\x00', end='')

def send(data, dont_cache=False):
    str = json.dumps(data)
    print('\x1b\x1a' + ('Q' if dont_cache else 'M') + str + '\x00', end='')