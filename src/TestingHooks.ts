import { currentWaits, waitForAnyWorkToFinish } from './async';
import { rootBlock } from './GridPane';
import { LogView } from './LogView';
import { activePick } from './QuickPick';

class TestingHooks {
  rootBlock = rootBlock;
  async serializeForTest() {
    if (activePick)
      return activePick.serializeForTest();
    return rootBlock.serializeForTest();
  }
  async waitForAnyWorkToFinish() {
    await waitForAnyWorkToFinish();
  }
  currentWaitsForTest() {
    return currentWaits();
  }
  waitForLineForTest(regex: RegExp) {
    // TODO do something when there is a split?
    return (rootBlock.block as LogView).waitForLineForTest(regex);
  }
  enableMockAI() {
    return (rootBlock.block as LogView).enableMockAI();
  }
}
declare global {
  interface Window { testingHooks: TestingHooks; }
}
window.testingHooks = new TestingHooks();
