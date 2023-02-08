import './index.css';
declare var d4: {
  waitForMessage<T>(): Promise<T>;
  setHeight(height: number): void;
};
window.onresize = updateSize;
function updateSize() {
  d4.setHeight(document.body.offsetHeight);
}

let antiCache = 0;
while (true) {
  const message = await d4.waitForMessage<{filePath: string, mimeType: string}>();
  const {filePath, mimeType} = message;
  if (mimeType.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = filePath + '?' + antiCache++;
    image.onload = () => {
      updateSize();
    };
    document.body.append(image);
  } else if (mimeType.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = filePath + '?' + antiCache++;
    document.body.append(video);
    video.oncanplay = () => {
      updateSize();
    }
    updateSize();
  }
}
