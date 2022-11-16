import { JSLogBlock } from '../src/JSBlock';
import './console.css';
import { JoelEvent } from '../src/JoelEvent';
import type { TargetManager, WebKitSession } from './TargetManager';
import { WebKitProtocol } from '../src/webkitProtocol';

export class Console {
  element = document.createElement('div');
  private _lockingScroll = false;
  private _scroller = this.element;
  constructor(targetManager: TargetManager) {
    targetManager.addListener({
      targetAdded: target => {
        target.addListener({
          sessionUpdated: session => {
            session.on('Console.messageAdded', event => {
              // console.log('Console.messageAdded', event.message);

              // TODO need to attribute message to a frame
            });
            session.send('Console.disable', {}).catch(e => console.warn(e));
            session.send('Console.enable', {}).catch(e => console.warn(e));
            // for (const frame of target.frames)
            //   sessionManager.showFrame(frame);
          },
          frameAdded: frameUUID => {
            // sessionManager?.showFrame(frameUUID);
          },
          frameRemoved: frameUUID => {
            // sessionManager?.hideFrame(frameUUID);
          },
        })
      },
      targetRemoved: target => {
      },
    });

    // const size = new JoelEvent({ rows: 24, cols: 80 });
    // this.element.classList.add('console');
    // const itemWillResize = () => {
    //   this._lockScroll();
    // };
    // this._client.on('Runtime.consoleAPICalled', params => {
    //   const block = new JSLogBlock(params, this._client, size);
    //   block.willResizeEvent.on(itemWillResize);
    //   this._lockScroll();
    //   this.element.appendChild(block.render());
    // });
    // this._client.send('Runtime.enable', {});
    // new ResizeObserver(() => {
    //   const { width, height } = this.element.getBoundingClientRect();
    //   const char = measureChar();
    //   const PADDING = 4;
    //   const padding = PADDING / window.devicePixelRatio;
    //   const cols = Math.floor((width - padding * 2) / char.width);
    //   const rows = Math.floor((window.devicePixelRatio * (height - padding * 2)) / Math.ceil(char.height * window.devicePixelRatio));
    //   size.dispatch({ cols, rows });
    // }).observe(this.element)
  }

  async _lockScroll() {
    if (this._lockingScroll)
      return;
    const scrollBottom = this._scroller.scrollHeight - this._scroller.scrollTop - this._scroller.offsetHeight;

    this._lockingScroll = true;
    await Promise.resolve();
    this._lockingScroll = false;
    this._scroller.scrollTop = this._scroller.scrollHeight - this._scroller.offsetHeight - scrollBottom;
  }

}

function measureChar() {
  const div = document.createElement('div');
  div.style.font = window.getComputedStyle(document.body).font;
  div.style.position = 'absolute';
  div.style.top = '-1000px';
  div.style.left = '-1000px';
  div.style.lineHeight = 'normal';
  div.style.visibility = 'hidden';
  div.textContent = 'W'.repeat(10);
  document.body.appendChild(div);
  const { width, height } = div.getBoundingClientRect();
  div.remove();
  return { width: Math.floor(window.devicePixelRatio * width / 10) / window.devicePixelRatio, height: Math.ceil(height) };
}
