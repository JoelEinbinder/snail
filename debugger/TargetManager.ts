/// <reference path="../iframe/types.d.ts" />
import {RPC} from '../src/RPC';
import { WebKitProtocol } from '../src/webkitProtocol';

interface TargetListener {
  targetAdded(target: WebKitTarget): void;
  targetRemoved(target: WebKitTarget): void;
}

export class TargetManager {
  private _targets = new Map<string|undefined, WebKitTarget>();
  private _listeners = new Set<TargetListener>();
  constructor() {
    this.startup();
  }
  
  addListener(listener: TargetListener) {
    this._listeners.add(listener);
    for (const target of this._targets.values())
      listener.targetAdded(target);
  }

  removeListener(listener: TargetListener) {
    this._listeners.delete(listener);
  }

  async startup() {
    const sendMessage = await d4.attachToCDP({
      onDebuggeesChanged: debuggees => {
        const newTargets = new Map<string|undefined, WebKitTarget>();
        const framesForBrowserView = new Map<string|undefined, Set<string|undefined>>();
        const addTarget = (browserViewUUID?: string) => {
          const existingTarget = this._targets.get(browserViewUUID);
          if (existingTarget)
            newTargets.set(browserViewUUID, existingTarget);
          else
            newTargets.set(browserViewUUID, new WebKitTarget(sendMessage));
          framesForBrowserView.set(browserViewUUID, new Set());
        }
        // always add undefined target for the main page
        addTarget(undefined);
        for (const [shellUUID, debuggee] of Object.entries(debuggees)) {
          if (!newTargets.has(debuggee.browserViewUUID))
            addTarget(debuggee.browserViewUUID);
          framesForBrowserView.get(debuggee.browserViewUUID)!.add(debuggee.frameUUID);
        }
        const oldTargets = this._targets;
        this._targets = newTargets;
        for (const [key, value] of oldTargets) {
          if (newTargets.has(key)) continue;
          for (const listener of this._listeners)
            listener.targetRemoved(value);
        }
        for (const [key, value] of newTargets) {
          if (oldTargets.has(key)) continue;
          for (const listener of this._listeners)
            listener.targetAdded(value);
        }
        for (const [browserViewUUID, frames] of framesForBrowserView)
          this._targets.get(browserViewUUID)!._updateFrames(frames);
      },
      onMessage: (message, browserViewUUID) => {
        this._targets.get(browserViewUUID)!._listener(message);
      }
    });
  }
}

export type WebKitSession = RPC<{
  [key in keyof WebKitProtocol.CommandParameters]: (params: WebKitProtocol.CommandParameters[key]) => WebKitProtocol.CommandReturnValues[key];
}, WebKitProtocol.Events>;
export interface WebKitTargetListener {
  sessionUpdated(session: WebKitSession): void;
  frameAdded(frameUUID: string|undefined): void;
  frameRemoved(frameUUID: string|undefined): void;
}

export class WebKitTarget {
  frames = new Set<string|undefined>();
  private topLevelRPC: WebKitSession;
  rpc?: WebKitSession;
  _listener: (message: any) => void;
  private _listeners = new Set<WebKitTargetListener>();
  constructor(send: (message: any) => void) {
    this.topLevelRPC = new RPC({
      listen: listener => {
        this._listener = listener;
      },
      send,
    });
    const rpcListenerForPage = new Map<string, (message: any) => void>();
    this.topLevelRPC.on('Target.targetCreated', event => {
      if (event.targetInfo.type !== 'page')
        return;
      if (event.targetInfo.isProvisional)
        return;
      this.rpc = new RPC({
        listen: (listener) => {
          rpcListenerForPage.set(event.targetInfo.targetId, listener);
        },
        send: (message) => {
          this.topLevelRPC.send('Target.sendMessageToTarget', {
            message: JSON.stringify(message),
            targetId: event.targetInfo.targetId,
          });
        }
      });
      for (const listener of this._listeners)
        listener.sessionUpdated(this.rpc);
    });
    this.topLevelRPC.on('Target.dispatchMessageFromTarget', params => {
      rpcListenerForPage.get(params.targetId)!(JSON.parse(params.message));
    });
  }

  addListener(listener: WebKitTargetListener) {
    this._listeners.add(listener);
    if (this.rpc)
      listener.sessionUpdated(this.rpc);
    for (const frame of this.frames)
      listener.frameAdded(frame);
  }

  removeListener(listener: WebKitTargetListener) {
    this._listeners.delete(listener);
  }

  _updateFrames(frames: Set<string|undefined>) {
    const oldFrames = this.frames;
    this.frames = frames;
    for (const frame of oldFrames) {
      if (this.frames.has(frame))
        continue;
      for (const listener of this._listeners)
        listener.frameRemoved(frame);
    }
    for (const frame of this.frames) {
      if (oldFrames.has(frame))
        continue;
      for (const listener of this._listeners)
        listener.frameAdded(frame);
    }
  }
}

