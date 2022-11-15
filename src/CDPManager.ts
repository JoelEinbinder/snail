import { host } from "./host";

export type DebuggingInfo = {
  browserViewUUID?: string;
  frameUUID?: string;
  type: 'webkit'|'chromium'|'node';
};

interface CDPListener {
  onMessage(message: any, browserViewUUID?: string): void;
  updateDebuggees(debuggess: {[key: string]: DebuggingInfo}): void;
}


class CDPManager {
  private _map = new Map<string, DebuggingInfo>();
  private _listener?: CDPListener;
  constructor() {
    host.onEvent('messageFromCDP', ({browserViewUUID, message}) => {
      this._listener?.onMessage(message, browserViewUUID);
    });
  }
// Should we do a complete proxy here? Certainly nice for chromium where we have Target.attachToTarget for iframes
// For WebKit, kind of annoying becuase there is no multiclient. Would need to manually manage nodeIds for DOM.
// We can get away with never handling two debuggers. This means that the debugger will always detach fully at some point.


// Maybe all thats needed is an extra layer here for dealing with the frameId and root 


// Iframe Content
// via host
// Shell's NodeJS
//   Start unix socket -> Inspector environment variable -> preload script -> connect to socket -> notify via bootstrap
//   
// Web's Server
//   Server responds with DevTools Debugging Websocket URL header -> detected by frontend ->  connect to DDWUH -> Authenticate -> Acquire Debugging Token Cookie -> Set Cookie -> Send TargetCreated and waitForDebugger on all new requests with token
//   This one is entirely in the DevTools frontend. So not needed here?
  setDebuggingInfoForTarget(targetId: string, info: DebuggingInfo) {
    this._map.set(targetId, info);
    this._updateListeners();
  }
  removeDebuggingInfoForTarget(targetId: string) {
    this._map.delete(targetId);
    this._updateListeners();
  }
  _updateListeners() {
    this._listener?.updateDebuggees(Object.fromEntries(this._map.entries()));
  }
  sendMessage(message: any, browserViewUUID?: string) {
    host.notify({method: 'sendMessageToCDP', params: {message, browserViewUUID}});
  }
  attachCDPListener(listener: CDPListener) {
    host.notify({method: 'attachToCDP', params: {}});
    this._listener = listener;
    this._updateListeners();
  }
  detachCDPListener() {
    delete this._listener;
    host.notify({method: 'detachFromCDP'});
  }
}

export const cdpManager = new CDPManager();