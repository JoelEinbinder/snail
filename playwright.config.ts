import type { PlaywrightTestConfig } from '@playwright/test';
import { devices, _electron } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  timeout: 15 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    actionTimeout: 0,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'electron',
      // TODO specify that this is electron somehow and add other browsers
    }
  ],

  outputDir: 'test-results/',
};

export default config;
