/// <reference path="../slug/iframe/types.d.ts" />
export {};

import ghost1 from './monsters/ghost1.png';
import ghost2 from './monsters/ghost2.png';
import ghost3 from './monsters/ghost3.png';
import type { Monster } from './dungeon';
const images = { ghost1, ghost2, ghost3 };
const monster = await d4.waitForMessage<Monster>();
console.log(monster);
const image = new Image();
document.body.append(image);
image.src = images[monster.image];
image.height = 300;
image.onload = () => {
  d4.setHeight(document.body.offsetHeight);  
};

