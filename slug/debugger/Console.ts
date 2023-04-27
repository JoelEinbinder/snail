import { JSLogBlock } from '../cdp-ui/JSBlock';
import './console.css';
import { JoelEvent } from '../cdp-ui/JoelEvent';
import type { TargetManager, ChromiumSession } from './TargetManager';
import type { JSConnection } from '../../src/JSConnection';
import type { Protocol } from '../../src/protocol';

type Log = {
  payload: Protocol.Runtime.consoleAPICalledPayload,
  session: ChromiumSession,
};
export class Console {
  element = document.createElement('div');
  private _lockingScroll = false;
  private _scroller = this.element;
  private _size = new JoelEvent({ rows: 24, cols: 80 });
  private _activeFrameIds = new Set<string>();
  private _processingFramesPromise: Promise<any> = Promise.resolve();
  constructor(targetManager: TargetManager) {
    this.element.classList.add('console');
    targetManager.addListener({
      targetAdded: target => {
        let activeSession: ChromiumSession;
        const pendingFrames = new Set<string|undefined>();
        const activeExecutionContexts = new Map<number, string>();
        const uuidToFrameId = new Map<string, string>();
        const frameAdded = async (frameUUID: string|undefined) => {
          if (!frameUUID)
            throw new Error('todo, deal with top level connections here');
          const selector = `iframe[name="${frameUUID}"]`;
          const {result} = await activeSession.send('Runtime.evaluate', {
            expression: `document.querySelector(${JSON.stringify(selector)})`
          });
          const {node} = await activeSession.send('DOM.describeNode', {
            objectId:  result.objectId,
          });
          uuidToFrameId.set(frameUUID, node.frameId!);
          this._activeFrameIds.add(node.frameId!);
        };
        target.addListener({
          sessionUpdated: session => {
            activeSession = session;
            activeExecutionContexts.clear();
            pendingFrames.clear();
            session.on('Runtime.consoleAPICalled', async params => {
              await this._processingFramesPromise;
              const log: Log = {
                payload: params,
                session,
              };
              if (activeExecutionContexts.has(params.executionContextId))
                this._addLog(log);
            });
            session.send('Runtime.enable', {});
            session.on('Runtime.executionContextCreated', async event => {
              const frameId = event.context.auxData?.frameId;
              if (!frameId)
                return; // TODO get worker logs somehow
              await this._processingFramesPromise;
              if (!this._activeFrameIds.has(frameId))
                return;
              activeExecutionContexts.set(event.context.id, frameId);
              if (event.context.auxData?.isDefault) {
                // TODO check for preserve log here
                this.element.textContent = '';
              }
            });
            session.on('Runtime.executionContextDestroyed', async event => {
              await this._processingFramesPromise;
              activeExecutionContexts.delete(event.executionContextId);
            });
            for (const frame of pendingFrames)
              this._processingFramesPromise = Promise.all([frameAdded(frame), this._processingFramesPromise]);
            pendingFrames.clear();
          },
          frameAdded: frameUUID => {
            // TODO check for preserve log here
            this.element.textContent = '';
            if (!activeSession)
              pendingFrames.add(frameUUID)
            else
              this._processingFramesPromise = Promise.all([frameAdded(frameUUID), this._processingFramesPromise]);
          },
          frameRemoved: async frameUUID => {
            if (!frameUUID)
              throw new Error('todo, deal with top level connections here');
            pendingFrames.delete(frameUUID);
            await this._processingFramesPromise;
            console.log('delete active frame', uuidToFrameId.get(frameUUID));
            const frameId = uuidToFrameId.get(frameUUID);
            if (frameId) {
              this._activeFrameIds.delete(frameId);
              for (const [contextId, cframeId] of activeExecutionContexts) {
                if (frameId === cframeId)
                  activeExecutionContexts.delete(contextId);
              }
            }
          },
        })
      },
      targetRemoved: target => {
      },
    });

    new ResizeObserver(() => {
      const { width, height } = this.element.getBoundingClientRect();
      const char = measureChar();
      const PADDING = 4;
      const padding = PADDING / window.devicePixelRatio;
      const cols = Math.floor((width - padding * 2) / char.width);
      const rows = Math.floor((window.devicePixelRatio * (height - padding * 2)) / Math.ceil(char.height * window.devicePixelRatio));
      this._size.dispatch({ cols, rows });
    }).observe(this.element)
  }

  _addLog(log: Log) {
    const block = new JSLogBlock(log.payload, (log.session as unknown) as JSConnection, this._size);
    block.willResizeEvent.on( () => {
      this._lockScroll();
    });
    this._lockScroll();
    this.element.appendChild(block.render());
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

  toJSON() {
    return {
      type: 'Console',
    };
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
