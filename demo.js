// document.body.append('hi hi hi');
// const image = document.createElement('img');
// image.src = '/Applications/Signal.app/?thumbnail';
// image.width = image.height = 16;
// document.body.append(image);

const {dirs, cwd} = await d4.waitForMessage();

for (const dir of dirs) {
  const div = document.createElement('div');
  const image = document.createElement('img');
  image.src = `${cwd}/${dir}?thumbnail`;
  image.width = image.height = 16;
  image.style.verticalAlign = 'middle';
  image.style.margin = '0 2px'
  div.append(image, dir);
  div.style.display = 'inline-block';
  div.style.width = '400px';
  div.style.overflow = 'hidden';
  document.body.append(div);
}

d4.setHeight(document.body.offsetHeight);