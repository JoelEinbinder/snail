import { IHTMLBlock } from 'xterm';
export interface IColorSet {
  foreground: IColor;
  background: IColor;
  cursor: IColor;
  cursorAccent: IColor;
  selectionTransparent: IColor;
  /** The selection blended on top of background. */
  selectionOpaque: IColor;
  ansi: IColor[];
}
export interface IColor {
  css: string;
  rgba: number; // 32-bit int with rgba in each byte
}

export class HTMLBlock implements IHTMLBlock {
  private _div = document.createElement('iframe');
  constructor(
    public x: number,
    public y: number,
    public height: number,
    public html: string
  ) {
    this.height = isNaN(height) ? 1 : Math.max(height, 1);
    this._div.style.position = 'absolute';
    this._div.style.zIndex = '10';
    this._div.style.border = '0';
    // make text line up exactly with the canvas
    // This is a hack. we should really have lineheight
    this._div.style.transform = 'translateY(2px)';
    // this._div.sandbox.value = '';
  }

  public render(top: number, bottom: number, cellWidth: number, cellHeight: number, font: string, colors: IColorSet, container: HTMLElement): void {
    if (this.y + this.height < top || bottom < this.y) {
      this._div.remove();
      return;
    }
    const dpr = realDevicePixelRatio();
    cellHeight /= dpr;
    cellWidth /= dpr;
    const left = this.x * cellWidth;
    this._div.style.top = (this.y - top) * cellHeight + 'px';
    this._div.style.left = left + 'px';
    this._div.style.width = (container.getBoundingClientRect().width - left) + 'px';
    // this._div.style.height = this.height * cellHeight + 'px';
    this._div.height = String(this.height * cellHeight);
    const colorRules: string[] = [];
    if (!this._div.isConnected) {
      container.appendChild(this._div);
      if (!this._div.isConnected)
        return;
      this._div.contentDocument!.write(this.html);
      const style = this._div.contentDocument!.createElement('style');
      addColorRule('background', colors.background);
      addColorRule('foreground', colors.foreground);
      addColorRule('cursor', colors.cursor);
      addColorRule('cursor-accent', colors.cursorAccent);
      addColorRule('selection-opaque', colors.selectionOpaque);
      addColorRule('selection-transparent', colors.selectionTransparent);
      for (let i = 0; i < colors.ansi.length; i++) {
        addColorRule(`ansi-${i}`, colors.ansi[i]);
      }
      style.innerHTML = `body { margin: 0; font: ${font}; ${colorRules.join('; ')}; color: var(--color-foreground); } ::selection { background: var(--color-selection-transparent); }`;
      this._div.contentDocument!.head.appendChild(style);
    }
    function addColorRule(name: string, color: IColor): void {
      colorRules.push(`--color-${name}: ${color.css}`);
    }
  }

  public dispose(): void {
    this.hide();
  }

  public hide(): void {
    this._div.remove();
  }
}

const isWebKit = /WebKit/.test(navigator.userAgent);
const isChrome = /Chrome/.test(navigator.userAgent);
export function realDevicePixelRatio() {
  if (isChrome)
    return window.devicePixelRatio;
  if (isWebKit) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('version', '1.1');
    document.body.appendChild(svg);
    const dpr = svg.currentScale * window.devicePixelRatio;
    svg.remove();
    return dpr;
  }
  return window.devicePixelRatio;
}