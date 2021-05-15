import { IHTMLBlock } from 'xterm';

export class HTMLBlock implements IHTMLBlock {
  private _div = document.createElement('iframe');
  constructor(
    public x: number,
    public y: number,
    public html: string
  ) {
    this._div.style.position = 'absolute';
    this._div.style.zIndex = '10';
    this._div.style.border = '0';
    // make text line up exactly with the canvas
    // This is a hack. we should really have lineheight
    this._div.style.transform = 'translateY(0.5px)';
    // this._div.sandbox.value = '';
  }

  public render(top: number, bottom: number, cellWidth: number, cellHeight: number, font: string, container: HTMLElement): void {
    const height = 5;
    if (this.y + height < top || bottom < this.y) {
      this._div.remove();
      return;
    }
    cellHeight /= window.devicePixelRatio;
    cellWidth /= window.devicePixelRatio;
    const left = this.x * cellWidth;
    this._div.style.top = (this.y - top) * cellHeight + 'px';
    this._div.style.left = left + 'px';
    this._div.style.width = (container.getBoundingClientRect().width - left) + 'px';
    this._div.style.height = height * cellHeight + 'px';
    if (!this._div.isConnected) {
      container.appendChild(this._div);
      this._div.contentDocument!.write(this.html);
      const style = this._div.contentDocument!.createElement('style');
      style.innerHTML = `body { color: white; margin: 0; font: ${font}}`;
      this._div.contentDocument!.head.appendChild(style);
    }
  }
}
