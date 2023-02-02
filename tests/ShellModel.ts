import type { Page } from '@playwright/test';
// for declare global side effect
import type { } from '../src/TestingHooks';
export class ShellModel {
  private constructor(public page: Page) {
  }
  static async create(page: Page) {
    const shell = new ShellModel(page);
    await shell.waitForAsyncWorkToFinish();
    return shell;
  }
  async runCommand(command: string) {
    const textarea = this.page.locator('textarea:enabled');
    await textarea.fill(command, {
      force: true,
    });
    await textarea.press('Enter');
    await this.waitForAsyncWorkToFinish();
  }

  async typeInPrompt(text: string) {
    const textarea = this.page.locator('textarea:enabled');
    await textarea.type(text);
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
  async serialize() {
    return await this.page.evaluate(() => {
      const hooks = window.testingHooks;
      return hooks.serializeForTest();
    });
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
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Control+D');
    await this.waitForAsyncWorkToFinish();
  }
}