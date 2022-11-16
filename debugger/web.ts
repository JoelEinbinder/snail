/// <reference path="../iframe/types.d.ts" />
import {TargetManager} from './TargetManager';
import { Console } from './Console';
import { Elements } from './Elements';
import { Tabs } from './ui/Tabs';
import { Sources } from './Sources';
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

const tabs = new Tabs();
const elementsPanel = new Elements(targetManager);
tabs.appendTab({
  focus() {
    elementsPanel.focus();
  },
  hide() {
    elementsPanel.element.remove();
  },
  show(parentElement) {
    parentElement.appendChild(elementsPanel.element);
  },
}, 'Elements');
const consolePanel = new Console(targetManager);
tabs.appendTab({
  focus() {
  },
  hide() {
    consolePanel.element.remove();
  },
  show(parentElement) {
    parentElement.appendChild(consolePanel.element);
  },
}, 'Console');
const sourcesPanel = new Sources(targetManager);
tabs.appendTab({
  focus() {
  },
  hide() {
    sourcesPanel.element.remove();
  },
  show(parentElement) {
    parentElement.appendChild(sourcesPanel.element);
  },
}, 'Sources');
document.body.appendChild(tabs.element);
