// TODO use https://www.electronjs.org/docs/latest/api/structures/display
const nativeDPI = 2;
class ExternalGlassPane {
  window?: Window;
  constructor(public element: HTMLElement) {
    const observer = new ResizeObserver(() => {
      this._resize();
    });
    observer.observe(this.element);
  }
  _resize() {
    if (!this.showing())
      return;
    const rect = this.element.getBoundingClientRect();
    this.window.resizeTo(rect.width, rect.height);
  }
  show() {
    if (this.window)
      return;
    this.window = window.open('', '', 'width=10,height=10');
    for (const sheet of window.document.styleSheets)
      if (sheet.ownerNode instanceof Element)
        this.window.document.head.appendChild(sheet.ownerNode.cloneNode(true));
    this.window.document.body.appendChild(this.element);
    this.window.document.body.classList.add('glass-pane');
    this.window.onclose = () => {
      delete this.window;
    }
    this._resize();
  }
  showing() {
    if (!this.window)
      return false;
    if (this.window.closed) {
      delete this.window;
      return false;
    }
    return true;
  }
  hide() {
    if (!this.showing())
      return;
    delete this.window;
    window.electronAPI.sendMessage({
      method: 'closeAllPopups',
      params: {}
    })
  }
  position(x: number, y: number) {
    const origin = this.origin();
    this.window.moveTo(x + origin.x, y + origin.y);
  }
  origin() {
    return {
      x: screenLeft,
      y: screenTop - window.innerHeight + window.outerHeight
    }
  }
  availableRect() {
    const origin = this.origin();
    return {
      top: -origin.y,
      left: -origin.x,
      right: screen.width - origin.x,
      bottom: screen.height - origin.y
    };
  }
}

class InPageGlassPane {
  constructor(public element: HTMLElement) {
      this.element.style.position = 'fixed';
      this.element.style.top = '0';
      this.element.style.left = '0';
  }
  showing() {
      return !!this.element.parentElement;
  }
  show() {
      if (!this.element.parentElement)
          document.body.appendChild(this.element);
  }
  hide() {
      this.element.remove();
  }
  position(x: number, y: number) {
      this.element.style.top = y + 'px';
      this.element.style.left = x + 'px';
  }
  availableRect() {
      return {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight
      };
  }
}

export const GlassPlane = window.electronAPI ? ExternalGlassPane : InPageGlassPane;
export type GlassPlane = ExternalGlassPane | InPageGlassPane;