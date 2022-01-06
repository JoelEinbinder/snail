import { Editor } from "../editor/js/editor";

export class Autocomplete {
    private _suggestBox = new SuggestBox(window);
    constructor(private _editor: Editor) {
        this._editor.on('selectionChanged', event => {
            if (this._editor.selections.length !== 1 || this._editor.somethingSelected())
                this._suggestBox.hide();
            else
                this.updateSuggestBox();
        });
        this._editor.element.addEventListener('focusout', () => {
            this._suggestBox.hide();
        });
        this._editor.element.addEventListener('keydown', event => {
            const activationChars = ' ';
            const legalChars = /[A-Za-z0-9_\$]/;
            if (this._suggestBox.showing) {
                if (event.key === 'Escape') {
                    this._suggestBox.hide();
                } else {
                    return;
                }
            } else {
                const selections = this._editor.selections;
                if (selections.length !== 1)
                    return;
                if (this._editor.somethingSelected())
                    return;
                if (event.key === ' ' && event.ctrlKey) {
                    this.showSuggestBox();
                } else if (event.code === 'Tab') {
                    if (selections[0].start.column === 0)
                        return;
                    this.showSuggestBox();
                } else if (activationChars.includes(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    this.showSuggestBox();
                    return;
                } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && legalChars.test(event.key)) {
                    if (selections[0].start.column !== 0)
                        return;
                    this.showSuggestBox();
                    return;
                 } else {
                    return;
                }
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
    }

    updateSuggestBox() {
        if (!this._suggestBox.showing)
            return;
        this.showSuggestBox();
    }

    showSuggestBox() {
        const location = this._editor.selections[0].start;
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
    }
    get showing() {
        return !!this.element.parentElement;
    }
    hide() {
        this.element.remove();
    }
    fit(x: number, top: number, bottom: number, availableRect: { top: number, left: number, bottom: number, right: number }) {
        window.document.body.appendChild(this.element);
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
