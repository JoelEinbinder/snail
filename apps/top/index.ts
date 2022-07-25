import './index.css';
declare var d4: {
  waitForMessage<T>(): Promise<T>;
  setHeight(height: number): void;
  setIsFullscreen(isFullscreen: boolean);
  sendInput(input: string);
};
window.onresize = updateSize;
function updateSize() {
  d4.setHeight(document.body.offsetHeight);
}

d4.setIsFullscreen(true);
document.body.append('yo yo yo');