import { fontString } from "./font";
import { host } from "./host";
import { themeName } from "./theme";

// TODO use https://www.electronjs.org/docs/latest/api/structures/display
const nativeDPI = 2;
class ExternalGlassPane {
  window?: Window;
  observer: ResizeObserver;
  onBlur = () => this.hide();
  constructor(public element: HTMLElement) {
    // MacOS will crash if try to make a new window while maximized.
    if (screenY === 0) {
      // @ts-ignore
      return new InPageGlassPane(element);
    }
  }
  resized() {
    if (!this.showing())
      return;
    const rect = this.element.getBoundingClientRect();
    host.sendMessage({
      method: 'resizePanel',
      params: {
        width: rect.width,
        height: rect.height
      }
    });
  }
  show() {
    if (this.window)
      return;
    window.addEventListener('blur', this.onBlur);
    this.window = window.open('', '', 'width=10,height=10');
    for (const sheet of window.document.styleSheets)
      if (sheet.ownerNode instanceof Element)
        this.window.document.head.appendChild(sheet.ownerNode.cloneNode(true));
    this.window.document.body.appendChild(this.element);
    this.window.document.body.classList.add('glass-pane');
    this.window.document.body.classList.add(themeName());
    this.window.document.body.style.setProperty('--current-font', fontString());
    // @ts-ignore
    this.window.document.body.style.zoom = window.devicePixelRatio / nativeDPI;
    this.window.onclose = () => {
      delete this.window;
    }
    this.resized();
  }

  _cleanupWindow() {
    if (!this.window)
      return;
    window.removeEventListener('blur', this.onBlur);
    delete this.window;
  }

  showing() {
    if (!this.window)
      return false;
    if (this.window.closed) {
      this._cleanupWindow();
      return false;
    }
    return true;
  }
  hide() {
    if (!this.showing())
      return;
    this._cleanupWindow();
    host.sendMessage({
      method: 'destroyPopup',
      params: {}
    })
  }
  async position(x: number, top: number, bottom: number) {
    const positionedAtBottom = await host.sendMessage({
      method: 'positionPanel',
      params: {
        x,
        top,
        bottom,        
      }
    });
    this.element?.classList.toggle('positioned-at-bottom', positionedAtBottom);
  }
}

class InPageGlassPane {
  constructor(public element: HTMLElement) {
      this.element.style.position = 'fixed';
      this.element.style.top = '0';
      this.element.style.left = '0';
      this.element.style.zIndex = '9999';
  }
  resized() {
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
  position(x: number, top: number, bottom: number) {
    const rect = this.element.getBoundingClientRect();
    const overflowTop = rect.height - top;
    const overflowBottom = (bottom + rect.height) - window.innerHeight;
    const positionedAtBottom = (overflowBottom <= 0 || (overflowBottom < overflowTop));
    const y = positionedAtBottom ? bottom : top - rect.height;

    this.element.style.left = x + 'px';
    this.element.style.top = y + 'px';
    this.element?.classList.toggle('positioned-at-bottom', positionedAtBottom);
  }
}

function supportsExternalGlassPane() {
  const forceInteralGlassPane = new URL(window.location.href).searchParams.get('forceInteralGlassPane');
  if (forceInteralGlassPane)
    return false;
  const isMac = navigator['userAgentData']?.platform === 'macOS' || navigator.platform === 'MacIntel';
  if ('electronAPI' in window && isMac)
    return true;
  if ('webkit' in window && !('snail' in window))
    return true;
  return false;
}

export const GlassPlane = supportsExternalGlassPane() ? ExternalGlassPane : InPageGlassPane;
export type GlassPlane = ExternalGlassPane | InPageGlassPane;