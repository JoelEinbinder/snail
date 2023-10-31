/// <reference path="../slug/iframe/types.d.ts" />
export {};

import werewolf from './monsters/werewolf_front.png';
import dragon from './monsters/dragon_front.png';
import fish from './monsters/fish_front.png';
const images = { werewolf, dragon, fish };
const image_name = await snail.waitForMessage<string>();
const image = new Image();
document.body.append(image);
image.src = images[image_name];
image.height = 300;
image.onload = () => {
  snail.setHeight(document.body.offsetHeight);  
};

