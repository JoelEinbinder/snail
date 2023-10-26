///<reference path="../slug/iframe/types.d.ts"/>
export {};
d4.setIsFullscreen(true);
const keys = {};
document.addEventListener('keydown', event => {
  keys[event.code] = true;
})
document.addEventListener('keyup', event => {
  delete keys[event.code];
});
document.addEventListener('blur', () => {
  for (const key in keys)
    delete keys[key];
});

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
canvas.style.position = 'absolute';
canvas.style.left = '0';
canvas.style.top = '0';
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
});
const ctx = canvas.getContext('2d')!;
const level_width = 2500;
const level_height = 512;
const blocks = [
  {x: -1000, y: level_height - 32, width: 1512, height: 32},
  {x: level_width - 412, y: level_height - 32, width: 1412, height: 32},
  {x: 600, y: level_height - 64, width: 100, height: 32},
  {x: 800, y: level_height - 96, width: 100, height: 32},
  {x: 1000, y: level_height - 128, width: 100, height: 32},
  {x: 1200, y: level_height - 160, width: 100, height: 32},
  {x: 1400, y: level_height - 192, width: 100, height: 32},
  {x: 1800, y: level_height - 64, width: 100, height: 32},
]
const player = { x: -32, y: 512-64, width: 32, height: 32, xspeed: 0, yspeed: 0};
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  const cameraX = Math.max(Math.min(0, -(player.x + player.width/2) + canvas.width / 2),  canvas.width - level_width);//;
  ctx.translate(cameraX, canvas.height - level_height);
  ctx.fillStyle = 'white';
  ctx.fillRect(player.x, player.y, player.width, player.height);
  for (const block of blocks) {
    ctx.fillStyle = 'gray';
    ctx.fillRect(block.x, block.y, block.width, block.height);
  }
  ctx.restore();
}

let sliding_in = true;
function step() {
  const acceleration = 0.25;
  const maxSpeed = 3;
  if (keys['ArrowLeft'] || keys['KeyA'])
    player.xspeed -= 1;
  if (sliding_in || keys['ArrowRight'] || keys['KeyD'])
    player.xspeed += 1;
  player.yspeed += 0.5;
  const friction = 1-acceleration/maxSpeed;
  player.xspeed *= friction;
  player.x += player.xspeed;
  for (const block of blocks) {
    if (!collides(block, player))
      continue;
    if (player.xspeed < 0)
      player.x = block.x + block.width;
    else if (player.xspeed > 0)
      player.x = block.x - player.width;
    player.xspeed = 0;
  }
  player.y += player.yspeed;
  let onground = false;
  for (const block of blocks) {
    if (!collides(block, player))
      continue;
    if (player.yspeed < 0)
      player.y = block.y + block.height;
    else if (player.yspeed > 0) {
      player.y = block.y - player.height;
      onground = true;
    }
    player.yspeed = 0;
  }
  if (onground && (keys['ArrowUp'] || keys['KeyW']))
    player.yspeed = -12;
  if (player.x >= 0)
    sliding_in = false;
  if (player.x + player.width < 2 && !sliding_in)
    close('cancel');
  else if (player.x > level_width)
    close('succeed');
  else if (player.y > level_height)
    close('die');
}
 

function close(message: 'cancel'|'succeed'|'die') {
  d4.sendInput(JSON.stringify(message) + '\n');
  d4.setIsFullscreen(false);
  clearInterval(interval);
}

type Rect = {
  x: number,
  y: number,
  width: number,
  height: number,
};
function collides(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const interval = setInterval(() => {
  step();
  draw();
}, 16);

window.dispatchEvent(new Event('resize'));