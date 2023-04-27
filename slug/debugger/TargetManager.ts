/// <reference path="../iframe/types.d.ts" />
import { RPC, type Transport} from '../protocol/RPC-ts';
import type { Protocol } from '../../src/protocol';

interface TargetListener {
  targetAdded(target: Target): void;
  targetRemoved(target: Target): void;
}

export class TargetManager {
  private _targets = new Map<string|undefined, Target>();
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
        const newTargets = new Map<string|undefined, Target>();
        const framesForBrowserView = new Map<string|undefined, Set<string|undefined>>();
        const addTarget = (browserViewUUID?: string) => {
          const existingTarget = this._targets.get(browserViewUUID);
          if (existingTarget)
            newTargets.set(browserViewUUID, existingTarget);
          else
            newTargets.set(browserViewUUID, new Target(sendMessage));
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

export type ChromiumSession = RPC<{
  [key in keyof Protocol.CommandParameters]: (params: Protocol.CommandParameters[key]) => Protocol.CommandReturnValues[key];
}, Protocol.Events>;
export interface ChromiumTargetListener {
  sessionUpdated(session: ChromiumSession): void;
  frameAdded(frameUUID: string|undefined): void;
  frameRemoved(frameUUID: string|undefined): void;
}

export class Target {
  frames = new Set<string|undefined>();
  rpc?: ChromiumSession;
  _listener: (message: any) => void;
  private _listeners = new Set<ChromiumTargetListener>();
  constructor(send: (message: any) => void) {
    const transport: Transport = {
      send,
    };
    this.rpc = new RPC(transport);
    this._listener = message => transport.onmessage!(message);
  }

  addListener(listener: ChromiumTargetListener) {
    this._listeners.add(listener);
    if (this.rpc)
      listener.sessionUpdated(this.rpc);
    for (const frame of this.frames)
      listener.frameAdded(frame);
  }

  removeListener(listener: ChromiumTargetListener) {
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

