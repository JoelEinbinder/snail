/// <reference path="../iframe/types.d.ts" />
document.body.textContent = 'im the web debugger';
d4.openDevTools();
const sendToCDP = await d4.attachToCDP(message => {
  console.log(message);
});
await sendToCDP({ id: 1, method: 'Runtime.enable' });

export {};