import { test, expect } from './fixtures';
import fs from 'fs';
test('chart should work', async ({ shell, workingDir }) => {
  const script = `
  const { chart } = require(${JSON.stringify(require.resolve('../slug/sdk/'))});
  for (let i = 0; i < 50_000; i++)
    chart({foo: i});
  `;
  await fs.promises.writeFile(workingDir + '/script.js', script);
  await shell.runCommand(`node script.js`);
  const { log: [, chart]} = await shell.serialize();
  expect(chart).toEqual({
    foo: {
      x: [0, 49_999],
      y: [0, 49_999],
    }
  })
});

test.skip('chart should reconnect with data intact', async ({ shellFactory, workingDir }) => {
  const count = 1_500_000;
  const script = `
  const { chart } = require(${JSON.stringify(require.resolve('../slug/sdk/'))});
  for (let i = 0; i < ${count}; i++)
    chart({foo: i});
  console.log('i am done');
  // keepalive
  setInterval(() => {}, 1000);
  `;
  await fs.promises.writeFile(workingDir + '/script.js', script);
  const shell1 = await shellFactory();
  shell1.runCommand(`node script.js`).catch(e => {});
  await shell1.waitForLine(/i am done/);
  const { log: [, chart]} = await shell1.serialize();
  expect(chart).toEqual({
    foo: {
      x: [0, count - 1],
      y: [0, count - 1],
    }
  });
  await shell1.close();

  const shell2 = await shellFactory();
  const commandPromise = shell2.runCommand(`reconnect`);
  await shell2.waitForLine(/i am done/);
  
  const { log: [,,,chart2]} = await shell2.serialize();
  expect(chart2).toEqual({
    foo: {
      x: [0, count - 1],
      y: [0, count - 1],
    }
  });
  await shell2.page.keyboard.press('Control+C');
  await commandPromise;
});

test('should not be slow', async ({ chart }) => {
  const time = await chart.line.evaluate(async line => {
    for (let i = 0; i < 2_000_000; i++)
      line.appendData([{ step: i, wallTime: Date.now(), value: i}]);
    const time = Date.now();
    window['chart'].draw();
    return Date.now() - time;
  });
  expect(time).toBeLessThan(150);
  await expect(chart.page).toHaveScreenshot();
});