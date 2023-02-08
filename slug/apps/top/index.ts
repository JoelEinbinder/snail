/// <reference path="../../iframe/types.d.ts" />
import './index.css';

window.onresize = updateSize;
function updateSize() {
  d4.setHeight(document.body.offsetHeight);
}

d4.setIsFullscreen(true);
document.body.append('yo yo yo');