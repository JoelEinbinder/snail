import * as snail from '../web';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
document.body.style.fontFamily = 'system-ui, sans-serif';
let text = '';
while(true) {
  const { data, baseDir} = await snail.waitForMessage<{data: string, baseDir: string}>();
  const baseURL = new URL(baseDir + '/', document.baseURI);
  console.log(baseDir, baseURL.href);
  text += data;
  const output = await marked(text);
  const clean = DOMPurify.sanitize(output, {});
  document.body.innerHTML = clean;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
  let node;
  while(node = walker.nextNode()) {
    if(node instanceof HTMLImageElement) {
      node.onload = resize;
      node.onerror = resize;
      console.log();
      const src = node.getAttribute('src');
      if (src)
        node.src = new URL(src, baseURL).toString();
    } else if(node instanceof HTMLAnchorElement) {
      const href = node.getAttribute('href');
      if (href)
        node.href = new URL(href, baseURL).toString();
      if (node.href.startsWith(baseURL.href)) {
        const n = node;
        n.addEventListener('click', event => {
          console.log('navigate', n.href);
          event.preventDefault();
          snail.tryToRunCommand(`show ${JSON.stringify(new URL(n.href).pathname)}`);
        });
      } else {
        node.target = '_blank';
      }
    }
  }
  resize();
}
function resize() {
  snail.setHeight(document.documentElement.offsetHeight);
}
window.onresize = resize;