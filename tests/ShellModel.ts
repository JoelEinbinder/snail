import type { Page } from '@playwright/test';
// for declare global side effect
import type { } from '../src/GridPane';
export class ShellModel {
  private constructor(public page: Page) {
  }
  static async create(page: Page) {
    const shell = new ShellModel(page);
    await shell.page.goto('http://localhost/gap-year/');
    return shell;
  }
  async runCommand(command: string) {
    await this.page.getByRole('textbox').fill(command);
    await this.page.getByRole('textbox').press('Enter');
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
}