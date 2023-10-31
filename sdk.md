# Snail SDK

Snail is a SDK for displaying rich content in the [Snail Terminal](https://github.com/JoelEinbinder/snail).

## Install Snail and SDK
1. Download the [Snail Terminal](https://github.com/JoelEinbinder/snail)
2. Install Snail SDK into your project
### Node
```sh
npm i snail-sdk
```
### Python
```sh
pip install snail-sdk
```

## Display some web content

The Snail SDK can display web content inline in the snail terminal. First create a .js file

### web.js
```js
document.body.textContent = 'Hello World!';
snail.setHeight(document.body.offsetHeight);
```

Then use the sdk to display the .js file

### Node
```js
const { display } = require('snail-sdk');
display(require.resolve('./web.js'));
```

### Python
```py
from pathlib import Path
from snail_sdk import display
display(Path(__file__).parent / "web.js")
```

## Send a message to web content

### web.js
```js
const data = await snail.waitForMessage();
document.body.textContent = `${data.greeting} ${data.name}!`;
snail.setHeight(document.body.offsetHeight);
```

Then use the sdk to display the .js file and send it a message.

### Node
```js
const { display, send } = require('snail-sdk');
display(require.resolve('./web.js'));
send({ name: 'Joel', greeting: 'Hey' });
```

### Python
```py
from pathlib import Path
from snail_sdk import display, send
display(Path(__file__).parent / "web.js")
send({ 'name': 'Joel', 'greeting': 'Hey' })
```

## Progress Bar

Snail's progress bars won't distrupt other text from your program. They stick in place no matter how many times they are updated. And you can see their status in the app icon.

### Node
```js
const { setProgress } = require('snail-sdk');
setProgress({ progress: 0.3, leftText: 'left', rightText: 'right'});
```

### Python
```py
from snail_sdk import set_progress
set_progress(0.3, left_text="left", right_text="right")
```

## Charts

Charts will appear inline in the terminal and update in real time.

### Node
```js
const { chart } = require('snail-sdk');
for (let i = 0; i < 100; i++)
  chart({ foo: Math.sin(i/10) });
```

### Python
```py
from snail_sdk import chart
import math
for i in range(100):
    chart({ 'foo': math.sin(i/10) })
```


## Web API

When displaying web content, there is a global `snail` object which communicates with the terminal.

### snail.waitForMessage<T>(): Promise<T>;
Waits for any returns any value sent from the `send` method in the sdk.

### snail.setHeight(height: number): void;
Sets the height of the web content. This must be called with a non-zero value in order for the web content be visible when not fullscreen.

### snail.setIsFullscreen(isFullscreen: boolean): void;
Set's the web content to take up the whole terminal screen. Fullscreen content will automatically close if the program which displayed that content closes.

### snail.sendInput(input: string): void;
Sends some data over stdin which could be read by the controlling program.

### snail.close(): void;
Remove the web content from the terminal

