import { Editor } from "../editor/js/editor";
import { SuggestBox } from "./SuggestBox";

export class Autocomplete {
    private _suggestBox = new SuggestBox(window, this._onPick.bind(this));
    private _abortController?: AbortController;
    private _wantsSuggestBoxShown = false;
    private _anchor = 0;
    constructor(private _editor: Editor, private _completer: Completer) {
        this._editor.on('selectionChanged', event => {
            this._abortController?.abort();
            delete this._abortController;
            if (this._editor.selections.length !== 1 || this._editor.somethingSelected())
                this.hideSuggestBox();
            else
                this.updateSuggestBox();
        });
        this._editor.element.addEventListener('focusout', () => {
            this.hideSuggestBox();
        });
        this._editor.element.addEventListener('keydown', event => {
            const activationChars = ' ';
            const legalChars = /[A-Za-z0-9_\$]/;
            if (this._suggestBox.showing) {
                if (event.key === 'Escape') {
                    this.hideSuggestBox();
                } else if (!this._suggestBox.onKeyDown(event)) {
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

    _onPick(suggestion: string) {
        const loc = this._editor.replaceRange(suggestion, {
            start: { line: this._editor.selections[0].start.line, column: this._anchor },
            end: { line: this._editor.selections[0].start.line, column: this._editor.selections[0].start.column + suggestion.length },
        });
        this.hideSuggestBox();
        this._editor.selections = [{ start: loc, end: loc }];
    }

    updateSuggestBox() {
        if (!this._wantsSuggestBoxShown)
            return;
        this.showSuggestBox();
    }

    hideSuggestBox() {
        this._wantsSuggestBoxShown = false;
        this._suggestBox.hide();
        this._abortController?.abort();
        delete this._abortController;
    }

    async showSuggestBox() {
        this._wantsSuggestBoxShown = true;
        const location = this._editor.selections[0].start;
        if (this._abortController)
            this._abortController.abort();
        const abortController = new AbortController();
        this._abortController = abortController;
        const textBeforeCursor = this._editor.text({ start: { line: location.line, column: 0 }, end: location });
        const {anchor, prefix, suggestions} = await this._completer(textBeforeCursor, abortController.signal);
        if (abortController.signal.aborted)
            return;

        const filtered = filterAndSortSuggestions(suggestions, prefix);
        if (!filtered.length) {
            this._suggestBox.hide();
            return;
        }
        this._anchor = anchor;
        this._suggestBox.setSuggestions(prefix, filtered);
        const point = this._editor.pointFromLocation({ line: location.line, column: anchor });
        const rect = this._editor.element.getBoundingClientRect();
        const top = point.y + rect.top;
        const bottom = top + this._editor.lineHeight() * .75;
        const availableRect = {
            top: 0,
            left: 0,
            right: window.innerWidth,
            bottom: window.innerHeight
        };
        this._suggestBox.fit(point.x + rect.left, top, bottom, availableRect);

    }
}

type Completer = (line: string, abortSignal: AbortSignal) => Promise<{anchor: number, prefix: string, suggestions: string[]}>;

function filterAndSortSuggestions(suggestions: string[], prefix: string) {
    const filtered = suggestions.filter(s => s.includes(prefix));
    filtered.sort((a, b) => {
        const aStart = a.startsWith(prefix);
        const bStart = b.startsWith(prefix);
        if (aStart === bStart)
            return a.localeCompare(b);        
        return aStart ? -1 : 1;
    });
    return filtered;
}