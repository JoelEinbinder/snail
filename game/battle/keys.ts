import {gamescreen} from './gamescreen';

const allButtons = ["A","B","Up","Down","Left","Right"] as const;
export type Button = typeof allButtons[number];
class KeyManager {
  private callbacks = new Map<Button, Set<((pressed: boolean) => void)>>();
  private keysPressed: {[key: string]: boolean} = {};
  private fakeButtonsPressed: {[key in Button]?: boolean} = {};
  private keydownCallbacks = new Set<(button: Button) => void>();
  private _waitForInputPromise: Promise<Button>;
  constructor() {
    document.addEventListener("keydown", e => {
      if (document.activeElement !== gamescreen && document.activeElement !== document.body) return;
      this._doUpdate(() => {
        this.keysPressed[e.code] = true;
      });
    });

    document.addEventListener("keyup", e => {
      if (document.activeElement !== gamescreen && document.activeElement !== document.body) return;
      this._doUpdate(() => {
        delete this.keysPressed[e.code];
      });

    });
    window.addEventListener("blur", () => {
      this._doUpdate(() => {
        this.keysPressed = {};
        this.fakeButtonsPressed = {};
      });
    });
    let callback: (button: Button) => void;
    this._waitForInputPromise = new Promise(x => callback = x);
    this.listenKeydown(button => {
      callback(button);
      this._waitForInputPromise = new Promise(x => callback = x);
    });
  }

  fakePress(button: Button) {
    this._doUpdate(() => {
      this.fakeButtonsPressed[button] = true;
    });
  }

  fakeUnpress(button: Button) {
    this._doUpdate(() => {
      delete this.fakeButtonsPressed[button];
    });
  }

  listen(button: Button, callback: (pressed: boolean) => void) {
    if (!this.callbacks.has(button))
      this.callbacks.set(button, new Set());
    this.callbacks.get(button).add(callback);
  }

  unlisten(button: Button, callback: (pressed: boolean) => void) {
    this.callbacks.get(button)?.delete(callback);
  }

  listenKeydown(callback: (button: Button) => void) {
    this.keydownCallbacks.add(callback);
  }

  _doUpdate(predicate: () => void) {
    const before = new Map();
    for (const button of allButtons)
      before.set(button, this.isPressed(button));
   
    predicate();
    const keydownCallbacks = [...this.keydownCallbacks];
    for (const button of allButtons) {
      const pressed = this.isPressed(button);
      if (before.get(button) !== pressed) {
        this.callbacks.get(button)?.forEach(callback => callback(pressed));
        if (pressed)
          keydownCallbacks.forEach(callback => callback(button));
      }
    }
  }
  
  isPressed(button: Button) {
    if (this.fakeButtonsPressed[button])
      return true;
    switch(button) {
      case 'A':
        return this.keysPressed['KeyZ'] || this.keysPressed['Space'] || this.keysPressed['Enter'];
      case 'B':
        return this.keysPressed['KeyX'] || this.keysPressed['KeyB'] || this.keysPressed['Backspace'] || this.keysPressed['Escape'];
      case 'Left':
        return this.keysPressed['ArrowLeft'] || this.keysPressed['KeyA'];
      case 'Right':
        return this.keysPressed['ArrowRight'] || this.keysPressed['KeyD'];
      case 'Up':
        return this.keysPressed['ArrowUp'] || this.keysPressed['KeyW'];
      case 'Down':
        return this.keysPressed['ArrowDown'] || this.keysPressed['KeyS'];
    }
    throw new Error('Unknown button: ' + button);
  }

  async waitForInput(): Promise<Button> {
    await Promise.resolve();
    return this._waitForInputPromise;
  }
}

export const keyManager = new KeyManager();