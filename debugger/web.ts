/// <reference path="../iframe/types.d.ts" />
import {TargetManager} from './TargetManager';
document.body.textContent = 'im the web debugger';
const targetManager = new TargetManager();
targetManager.addListener({
  targetAdded(target) {
    console.log('targetAdded', target);
    target.addListener({
      sessionUpdated(session) {
        console.log('session', session);
      },
      frameAdded(frameUUID) {
        console.log('frameAdded', frameUUID);
      },
      frameRemoved(frameUUID) {
        console.log('frameRemoved', frameUUID);
      }
    });
  },
  targetRemoved(target) {
    console.log('targetRemoved', target);
  },
})
export {};