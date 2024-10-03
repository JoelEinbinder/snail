import type { Locator, Page } from '@playwright/test';
// for declare global side effect
import type { } from '../src/TestingHooks';
import os from 'os';

class Split {
  constructor(public page: Page, protected _block: Locator) {
  }
  async runCommand(command: string) {
    const textarea = this._block.locator('textarea:enabled');
    await textarea.fill(command, {
      force: true,
    });
    await textarea.press('Enter');
    await this.waitForAsyncWorkToFinish();
  }

  async runPretypedCommand() {
    await this.page.keyboard.press('Enter');
    await this.waitForAsyncWorkToFinish();
  }

  async typeInPrompt(text: string) {
    const textarea = this._block.locator('textarea:enabled');
    await textarea.type(text);
    await this.waitForAsyncWorkToFinish();
  }

  async hackToEnsureKeyboardFocusIsOnFrame() {
    // Playwright doesn't wait for focus to hit the browser before sending keys
    // This means that right after a frame has been created, but before it's focus
    // has been reported, the keys will be sent to the page and not the iframe.
    // Poll for the focus to be on the iframe
    const gotKeyboardFocus = this.activeFrame().evaluate(() => new Promise<void>(resolve => {
      const eventListener = (event: KeyboardEvent) => {
        if (event.key !== 'F12')
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.removeEventListener('keydown', eventListener, true);
        resolve();
      };
      window.addEventListener('keydown', eventListener, true);
    }))
    // thread the renderer to ensure the listener is active
    await this.activeFrame().evaluate(() => 1);
    (async () => {
      let foundKey = false;
      gotKeyboardFocus.then(() => foundKey = true);
      let count = 0;
      while (!foundKey && count < 10) {
        count++;
        await this.page.keyboard.press('F12');
        await new Promise(x => setTimeout(x, 50));
      }
    })();
    return gotKeyboardFocus;
  }

  async historyUp() {
    const textarea = this._block.locator('textarea:enabled');
    await textarea.press('ArrowUp');
    await this.waitForAsyncWorkToFinish();
  }

  async historyDown() {
    const textarea = this._block.locator('textarea:enabled');
    await textarea.press('ArrowDown');
    await this.waitForAsyncWorkToFinish();
  }

  async openQuickOpen() {
    await this.page.keyboard.press(os.platform() === 'darwin' ? 'Meta+KeyP' : 'Control+KeyP');
    await this.waitForAsyncWorkToFinish();
  }
  async openQuickPick() {
    await this.page.keyboard.press(os.platform() === 'darwin' ? 'Shift+Meta+KeyP' : 'Shift+Control+KeyP');
    await this.waitForAsyncWorkToFinish();
  }
  async closeQuickPick() {
    await this.page.keyboard.press('Escape');
    await this.waitForAsyncWorkToFinish();
  }

  async waitForAsyncWorkToFinish() {
    await this.page.evaluate(async () => {
      if (document.readyState !== 'complete')
        await new Promise(x => window.addEventListener('load', x, { once: true }));
      const hooks = window.testingHooks;
      return hooks.waitForAnyWorkToFinish();
    });
  }
  async waitAndSerialize() {
    await this.waitForAsyncWorkToFinish();
    return this.serialize();
  }
  async serialize() {
    return await this.page.evaluate(async blockElement => {
      const hooks = window.testingHooks;
      const serialized = await hooks.serializeForTest();
      const path: number[] = [];
      let cursor = blockElement!;
      while (cursor !== hooks.rootBlock.element) {
        if (!cursor.parentElement)
          throw new Error('Block not found in root');
        path.push([...cursor.parentElement.children].filter(x => {
          return !x.classList.contains('tab-bar') && !x.classList.contains('divider'); 
        }).indexOf(cursor));
        cursor = cursor.parentElement;
      }
      let selected = serialized;
      for (const index of path.reverse()) {
        selected = serialized.children[index];
      }
      return selected;
    }, await this._block.elementHandle());
  }

  async currentWaits() {
    return await this.page.evaluate(() => {
      const hooks = window.testingHooks;
      return hooks.currentWaitsForTest();
    });
  }
  
  async waitForLine(regex: RegExp) {
    await this.page.evaluate(regex => {
      const hooks = window.testingHooks;
      return hooks.waitForLineForTest(regex);
    }, regex);
  }

  async toggleDemonMode() {    
    await this.page.keyboard.press('Control+B');
    await this.page.keyboard.press('Control+D');
    await this.waitForAsyncWorkToFinish();
  }

  async kill() {    
    await this.page.keyboard.press('Control+B');
    await this.page.keyboard.press('KeyK');
    await this.waitForAsyncWorkToFinish();
  }

  async close() {
    await this.page.close();
  }

  activeFrame() {
    return this.page.frames()[this.page.frames().length - 1];
  }

  scrollTop() {
    return this._block.locator('.log-view-scroller').evaluate(node => node.scrollTop);
  }

  setScrollTop(scrollTop: number) {
    return this._block.locator('.log-view-scroller').evaluate((node, scrollTop) => node.scrollTop = scrollTop, scrollTop);
  }

  async enableMockAI() {
    await this.page.evaluate(() => {
      const hooks = window.testingHooks;
      hooks.enableMockAI();
    });
  }

  async triggerLLM() {
    await this.page.keyboard.press('ControlOrMeta+L');
  }

  async setLanguage(language: import('../src/Shell').Language) {
    if (language === 'bash') {
      await this.page.keyboard.press('ControlOrMeta+K');
      await this.page.keyboard.press('KeyB');
    } else if (language === 'python') {
      await this.page.keyboard.press('ControlOrMeta+K');
      await this.page.keyboard.press('KeyP');
    } else if (language === 'shjs') {
      await this.page.keyboard.press('ControlOrMeta+K');
      await this.page.keyboard.press('KeyS');
    } else if (language === 'javascript') {
      await this.page.keyboard.press('ControlOrMeta+K');
      await this.page.keyboard.press('KeyJ');
    } else {
      throw new Error('Unknown language: ' + language);
    }
    await this.waitForAsyncWorkToFinish();
  }
}
export class ShellModel extends Split {
  private constructor(public page: Page) {
    super(page, page.locator('.root-block'));
  }
  static async create(page: Page) {
    const shell = new ShellModel(page);
    await shell.waitForAsyncWorkToFinish();
    return shell;
  }
  async splitHorizontally() {
    await this.page.keyboard.press('Control+B');
    await this.page.keyboard.press('Control+"');
    await this.waitForAsyncWorkToFinish();
    return [new Split(this.page, this._block.locator('> div:not(.divider):not(.tab-bar)').nth(0)), new Split(this.page, this._block.locator('> div:not(.divider):not(.tab-bar)').nth(1))];
  }
}
