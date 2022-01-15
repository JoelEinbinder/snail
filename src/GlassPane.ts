// TODO use https://www.electronjs.org/docs/latest/api/structures/display
const nativeDPI = 2;
class ExternalGlassPane {
  window?: Window;
  constructor(public element: HTMLElement) {
    // MacOS will crash if try to make a new window while maximized.
    if (screenY === 0) {
      // @ts-ignore
      return new InPageGlassPane(element);
    }
    const observer = new ResizeObserver(() => {
      this._resize();
    });
    observer.observe(this.element);
  }
  _resize() {
    if (!this.showing())
      return;
    const rect = this.element.getBoundingClientRect();
    this.window.resizeTo(rect.width * window.devicePixelRatio / nativeDPI, rect.height * window.devicePixelRatio / nativeDPI);
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
    // @ts-ignore
    this.window.document.body.style.zoom = window.devicePixelRatio / nativeDPI;
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
    this.window.moveTo((x + origin.x ) * window.devicePixelRatio / nativeDPI, (y + origin.y) * window.devicePixelRatio / nativeDPI);
  }
  origin() {
    return {
      x: screenLeft * nativeDPI / window.devicePixelRatio,
      y: screenTop * nativeDPI / window.devicePixelRatio - window.innerHeight + window.outerHeight * nativeDPI / window.devicePixelRatio
    }
  }
  availableRect() {
    const origin = this.origin();
    return {
      top: -origin.y,
      left: -origin.x,
      right: screen.width * nativeDPI / window.devicePixelRatio - origin.x,
      bottom: screen.height * nativeDPI / window.devicePixelRatio - origin.y
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