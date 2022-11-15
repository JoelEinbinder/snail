/// <reference path="../iframe/types.d.ts" />
import {RPC} from '../src/RPC';
document.body.textContent = 'im the web debugger';
class WebKitSender {
  public rawSend: (message: any) => void;
  private _callbacks = new Map<number, (value: any) => void>();
  private _lastId = 0;
  async send(method, params = undefined) {
    const id = ++this._lastId;
    this.rawSend({
      method,
      params,
      id,
    });
    const data = await new Promise<{result: any}|{error: any}>(callback => {
      this._callbacks.set(id, callback);
    });
    if ('error' in data)
      throw new Error(`WebKit Protocol Error: ${data.error}`);
    return data.result;
  }
  onMessage(message) {
    console.log(message);
    const {method, params, id, result, error} = message;
    if (method) {

    }
  }
}
let rawSend;
type TargetInfo = {
  targetId: string;
  type: 'page'|'service-worker'|'worker';
  isProvisional?: boolean;
  isPaused?: boolean;
};

const rpc = new RPC<{
  'Target.sendMessageToTarget': (params: {message: string, targetId: string}) => void;
}, {
  'Target.targetCreated': { targetInfo: TargetInfo },
  'Target.targetDestroyed': { targetId: string },
  'Target.dispatchMessageFromTarget': { targetId: string, message: string },
  'Target.didCommitProvisionalTarget': { newTargetId: string, oldTargetId: string },
}>({
  async listen(listener) {
    rawSend = await d4.attachToCDP({
      onDebuggeesChanged(debuggees) {
        console.log('onDebuggeesChanged', debuggees);
      },
      onMessage(message, browserViewUUID) {
        console.log('onMessage', message);
        listener(message);
      }
    });
  },
  send(message) {
    rawSend(message);
  }
});
rpc.on('Target.targetCreated', async ({targetInfo}) => {
  console.log('target created');
  rpc.send('Target.sendMessageToTarget', {
    targetId: targetInfo.targetId,
    message: JSON.stringify({
      method: 'DOM.getDocument',
      params: {},
      id: 2,
    })
  });
});
rpc.on('Target.dispatchMessageFromTarget', async({message, targetId}) => {
  console.log(JSON.parse(message));
});

export {};