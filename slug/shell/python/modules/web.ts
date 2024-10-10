import * as snail from '../../../sdk/web';

window.onresize = updateSize;
function updateSize() {
  snail.setHeight(document.body.offsetHeight);
}

const plots = new Map<number|string, HTMLImageElement>();
while (true) {
  const {svg, id} = await snail.waitForMessage<{
    svg: string,
    id: number|string,
  }>();
  if (!plots.has(id)) {
    const image = document.createElement('img');
    image.style.height = '400px';
    plots.set(id, image);
  }
  const image = plots.get(id)!;
  image.src = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  document.body.append(image);
  image.onload = () => {
    updateSize();
  };
}
