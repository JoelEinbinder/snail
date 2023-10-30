/// <reference path="../../iframe/types.d.ts" />
import './index.css';

window.onresize = updateSize;
function updateSize() {
  snail.setHeight(document.body.offsetHeight);
}

snail.setIsFullscreen(true);
document.body.append('yo yo yo');