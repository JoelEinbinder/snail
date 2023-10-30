/// <reference path="./types.d.ts" />
const error = atob(window.snail_error);
document.body.textContent = error;
snail.setToJSON({ error });
snail.setHeight(document.body.offsetHeight);