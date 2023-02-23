/// <reference path="./types.d.ts" />
const error = atob(window.snail_error);
document.body.textContent = error;
d4.setToJSON({ error });
d4.setHeight(document.body.offsetHeight);