export var width = 15, height = 10;
export var gamescreen = document.createElement("canvas");
export var gamearea = document.createElement("div");
gamearea.id = "gamearea";
document.body.append(gamearea);
export var ctx = gamescreen.getContext('2d');

var zoom = 0;
export function refreshZoom() {
    var z = Math.min(gamearea.offsetHeight / (height * 16), gamearea.offsetWidth / (width * 16));
    z = Math.floor(z * window.devicePixelRatio) / window.devicePixelRatio;
    z = Math.max(z, 1 / window.devicePixelRatio);
    if (zoom === z)
        return;
    zoom = z;
    gamescreen.style.width = width * zoom * 16 + "px";
    gamescreen.style.height = height * zoom * 16 + "px";
    gamescreen.width =  window.devicePixelRatio * width * zoom * 16;
    gamescreen.height =  window.devicePixelRatio * height * zoom * 16;
    ctx.scale(window.devicePixelRatio * zoom, window.devicePixelRatio * zoom);
    ctx.imageSmoothingEnabled = true;
}
function setSize(w, h) {
    width = w;
    height = h;
    refreshZoom();
}

export function initGameScreen() {
    gamescreen.tabIndex = 0;
    gamearea.appendChild(gamescreen);
    setSize(width, height);
    window.addEventListener("resize", refreshZoom, true);
}
