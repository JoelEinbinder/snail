/// <reference path="../../slug/iframe/types.d.ts" />
export {};

import door1 from './door1.png';
import door2 from './door2.png';
const images = [];
console.log({door1, door2, images});
for (const src of [door1, door2]) {
  const image = new Image();
  image.src = src;
  image.height = 300;
  images.push(image);
}
await Promise.all(images.map(image => new Promise(x => image.onload = x)));
for (const image of images) {
  document.body.textContent = '';
  document.body.append(image);
  snail.setHeight(document.body.offsetHeight);  
  await new Promise(x => setTimeout(x, 2500));
}

