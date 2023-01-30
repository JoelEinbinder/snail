import type { Page } from '@playwright/test';
// for declare global side effect
import type { } from '../src/GridPane';
export class ShellModel {
  private constructor(public page: Page) {
  }
  static async create(page: Page) {
    const shell = new ShellModel(page);
    return shell;
  }
  async runCommand(command: string) {
    const textarea = this.page.locator('textarea:enabled');
    await textarea.fill(command);
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
      const rootBlock = window.rootBlockForTest;
      return rootBlock.waitForAnyWorkToFinish();
    });
  }
  async serialize() {
    return await this.page.evaluate(() => {
      const rootBlock = window.rootBlockForTest;
      return rootBlock.serializeForTest();
    });
  }

  async currentWaits() {
    return await this.page.evaluate(() => {
      const rootBlock = window.rootBlockForTest;
      return rootBlock.currentWaitsForTest();
    });
  }
}