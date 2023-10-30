/// <reference path="../../iframe/types.d.ts" />
const {args} = await snail.waitForMessage<{
  args: string[],
}>();
document.body.innerHTML = args[2];
snail.setHeight(document.body.offsetHeight);
snail.setToJSON(() => `HTML: ${document.body.innerHTML}`);
export {};