import './sources.css';
import { Split } from './ui/Split';
import type { TargetManager, ChromiumSession } from './TargetManager';
import { Protocol } from '../src/protocol';
import { FileTree } from './FileTree';
export class Sources {
  element = document.createElement('div');
  private _fileTree = new FileTree();
  private _split = new Split();
  private _sourcePane = new SourcePane();
  private _activeFrameIds = new Set<string>();
  private _processingFramesPromise: Promise<any> = Promise.resolve();
  constructor(targetManager: TargetManager) {
    targetManager.addListener({
      targetAdded: target => {
        let activeSession: ChromiumSession|null = null;
        const pendingFrames = new Set<string|undefined>();
        const uuidToFrameId = new Map<string, string>();
        const frameAdded = async (frameUUID: string|undefined) => {
          if (!frameUUID)
            throw new Error('todo, deal with top level connections here');
          const selector = `iframe[name="${frameUUID}"]`;
          const {result} = await activeSession!.send('Runtime.evaluate', {
            expression: `document.querySelector(${JSON.stringify(selector)})`
          });
          const {node} = await activeSession!.send('DOM.describeNode', {
            objectId:  result.objectId,
          });
          uuidToFrameId.set(frameUUID, node.frameId!);
          this._activeFrameIds.add(node.frameId!);
        };

        const resetTree = () => {
          // TODO check for preserve log here
          this._fileTree.element.remove();
          this._fileTree = new FileTree();
          this._split.first.append(this._fileTree.element);
        };

        target.addListener({
          sessionUpdated: session => {
            activeSession = session;
            session.on('Debugger.scriptParsed', async payload => {
              await this._processingFramesPromise;
              const frameId = payload.executionContextAuxData?.frameId;
              if (!frameId || !this._activeFrameIds.has(frameId))
                return;
              if (!payload.url)
                return;
              console.log(payload);
              this._fileTree.appendItem(payload.url, () => {
                this._sourcePane.showScript(session, payload.scriptId);
              });
            }); 
            session.on('Runtime.executionContextCreated', async event => {
              // This whole method detects a frame refresh and clears stale sources
              // There almost certainly should be a better way to do this.
              const frameId = event.context.auxData?.frameId;
              if (!frameId)
                return;
              await this._processingFramesPromise;
              if (!this._activeFrameIds.has(frameId))
                return;
              if (event.context.auxData?.isDefault)
                resetTree();
            });
            session.send('Debugger.enable', {});
        
          },
          frameAdded: frameUUID => {
            resetTree();
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
            if (frameId)
              this._activeFrameIds.delete(frameId);
          },
        });
      },
      targetRemoved: target => {
      },
    })
    this.element.classList.add('sources');
    this.element.append(this._split.element);
    this._split.first.append(this._fileTree.element);
    this._split.second.append(this._sourcePane.element);
  }

  focus() {
    this._fileTree.focus();
  }
}

class SourcePane {
  element = document.createElement('div');
  private _showing: string | null = null;
  private _cachedSources = new Map<string, Promise<Protocol.Debugger.getScriptSourceReturnValue>>();
  constructor() {
    this.element.classList.add('source-pane');
  }
  async showScript(session: ChromiumSession, scriptId: string) {
    if (this._showing === scriptId)
      return;
    this._showing = scriptId;
    if (!this._cachedSources.has(scriptId))
      this._cachedSources.set(scriptId, session.send('Debugger.getScriptSource', { scriptId }));
    const source = await this._cachedSources.get(scriptId)!;
    this.element.textContent = source.scriptSource;
  }
}
