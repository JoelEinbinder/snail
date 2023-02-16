/// <reference path="../../iframe/types.d.ts" />
const {args} = await d4.waitForMessage<{
  args: string[],
}>();
document.body.innerHTML = args[2];
d4.setHeight(document.body.offsetHeight);
d4.setToJSON(() => `HTML: ${document.body.innerHTML}`);
export {};