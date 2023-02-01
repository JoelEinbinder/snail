import type { Page } from '@playwright/test';
// for declare global side effect
import type { } from '../src/TestingHooks';
export class ShellModel {
  private constructor(public page: Page) {
  }
  static async create(page: Page) {
    const shell = new ShellModel(page);
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
    await this.page.evaluate(() => {
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
}