import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import type { FindParams } from "./Find";
import { host } from "./host";
import type { LogItem } from "./LogItem";
import { formatShortcut, shortcutParser } from "./shortcutParser";
import './introBlock.css';

export class IntroBlock implements LogItem {
  willResizeEvent = new JoelEvent<void>(undefined);
  removeSelf?: () => void;
  render(): Element {
    const element = document.createElement('div');
    element.classList.add('intro-block');
    element.innerHTML = `
  <div>Python REPL</div>
  <div>With <a href="https://github.com/JoelEinbinder/snail">Snail</a> and <a href="https://pyodide.org/">Pyodide</a></div>
  <div>${formatShortcut(shortcutParser('Shift+CmdOrCtrl+P'))} opens Command Menu</div>
`;
    const closeButton = document.createElement('div');
    closeButton.setAttribute('role', 'button');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.classList.add('intro-close-button');
    closeButton.addEventListener('click', () => {
      this.removeSelf?.();
      host.notify({ method: 'saveItem', params: { key: 'closedIntro', value: true }});
    });
    element.appendChild(closeButton);
    return element;
  }
  focus() {
  }
  dispose() {
  }
  async serializeForTest() {
    return '<Intro Block>';
  }
  acceptsChildren?: boolean;
  setFind(params: FindParams): void {
  }

}