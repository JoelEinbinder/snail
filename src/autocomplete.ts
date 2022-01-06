import { Editor } from "../editor/js/editor";

export class Autocomplete {
    private _suggestBox = new SuggestBox(window);
    constructor(private _editor: Editor) {
        this._editor.on('selectionChanged', event => {
            const location = event.selections[0].start;
            const point = this._editor.pointFromLocation(location);
            
            const top = point.y;
            const bottom = point.y + this._editor.lineHeight() * .75;
            const availableRect = {
                top: 0,
                left: 0,
                right: window.innerWidth,
                bottom: window.innerHeight
            };
            this._suggestBox.fit(point.x, top, bottom, availableRect);
        });
    }
}

class SuggestBox {
    element: HTMLElement;
    constructor(window: Window) {
        this.element = window.document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.top = '0';
        this.element.style.left = '0';
        this.element.style.width = '50px';
        this.element.style.height = '50px';
        this.element.style.backgroundColor = 'rgba(0,0,0,0.5)';
        window.document.body.appendChild(this.element);
    }
    fit(x: number, top: number, bottom: number, availableRect: { top: number, left: number, bottom: number, right: number }) {
        const rect = this.element.getBoundingClientRect();
        const overflowTop = availableRect.top - (top - rect.height);
        const overflowBottom = (bottom + rect.height) - availableRect.bottom;
        if (overflowBottom <= 0 || (overflowBottom < overflowTop))
            this.position(x, bottom);
        else
            this.position(x, top - rect.height);
    }
    position(x: number, y: number) {        
        this.element.style.top = y + 'px';
        this.element.style.left = x + 'px';
    }
}
