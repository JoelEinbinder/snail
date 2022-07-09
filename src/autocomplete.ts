import { Editor } from "../editor/js/editor";
import { JoelEvent } from "./JoelEvent";
import { SuggestBox } from "./SuggestBox";

export class Autocomplete {
    private _suggestBox: SuggestBox|null = null;
    private _abortController?: AbortController;
    private _wantsSuggestBoxShown = false;
    private _anchor = 0;
    private _refreshingSuggestions = false;
    public suggestionChanged = new JoelEvent<void>(undefined);
    constructor(private _editor: Editor, private _completer: Completer, private _activationChars: string) {
        this._editor.on('selectionChanged', event => {
            this._abortController?.abort();
            delete this._abortController;
            if (this._editor.selections.length !== 1 || this._editor.somethingSelected() || this._editor.selections[0].start.column === 0)
                this.hideSuggestBox();
            else
                this.updateSuggestBox();
        });
        this._editor.element.addEventListener('focusout', () => {
            this.hideSuggestBox();
        });
        this._editor.element.addEventListener('keydown', event => {
            const legalChars = /[A-Za-z0-9_\$]/;
            if (this._suggestBox?.showing) {
                if (event.key === 'Escape') {
                    this.hideSuggestBox();
                } else if (event.key === 'ArrowUp' && this._suggestBox.selectedIndex <= 0) {
                    // hide suggest box but dont cancel event
                    this.hideSuggestBox();
                    // we want the history completions to kick in
                    return;
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
                } else if (event.code === 'Tab' && !event.shiftKey && !event.ctrlKey) {
                    if (selections[0].start.column === 0)
                        return;
                    this.showSuggestBox(true);
                } else if (this._activationChars.includes(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey) {
                    if (this._editor.line(selections[0].start.line).length !== selections[0].start.column)
                        return;
                    this._wantsSuggestBoxShown = true;
                    return;
                } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && legalChars.test(event.key)) {
                    if (this._editor.line(selections[0].start.line).length !== selections[0].start.column)
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

    valueWithSuggestion() {
        if (!this._suggestBox)
            return this._editor.value;
        const suggestion = this._suggestBox.currentSuggestion;
        if (!suggestion)
            return this._editor.value;
        const textBefore = this._editor.text({
            start: { line: 0, column: 0 },
            end: { line: this._editor.selections[0].start.line, column: this._anchor },
        });
        const textAfter = this._editor.text({
            start: { line: this._editor.selections[0].start.line, column: this._editor.selections[0].start.column },
            end: { line: Infinity, column: Infinity },
        });
        const text = textBefore + suggestion.text + textAfter;
        return text;
    }

    _onPick(suggestion: Suggestion) {
        const rangeToReplace = {
            start: { line: this._editor.selections[0].start.line, column: this._anchor },
            end: { line: this._editor.selections[0].start.line, column: this._editor.selections[0].start.column },
        };
        const prefix = this._editor.text(rangeToReplace);
        if (this._refreshingSuggestions && !suggestion.text.startsWith(prefix)) {
            this.hideSuggestBox();
            return true;
        }
        const loc = this._editor.replaceRange(suggestion.text, rangeToReplace);
        this.hideSuggestBox();
        this._editor.selections = [{ start: loc, end: loc }];
        if (this._activationChars.includes(suggestion.text[suggestion.text.length - 1])) {
            this.showSuggestBox();
            return true;
        }
        return prefix !== suggestion.text;
    }

    updateSuggestBox() {
        if (!this._wantsSuggestBoxShown)
            return;
        this.showSuggestBox();
    }

    hideSuggestBox() {
        this._wantsSuggestBoxShown = false;
        this._suggestBox?.hide();
        this._suggestBox = null;
        this._abortController?.abort();
        delete this._abortController;
        this.suggestionChanged.dispatch();
    }

    async showSuggestBox(autoaccept = false) {
        this._wantsSuggestBoxShown = true;
        const location = this._editor.selections[0].start;
        if (this._abortController)
            this._abortController.abort();
        const abortController = new AbortController();
        this._abortController = abortController;
        const textBeforeCursor = this._editor.text({ start: { line: location.line, column: 0 }, end: location });
        this._refreshingSuggestions = true;
        const {anchor, suggestions} = await this._completer(textBeforeCursor, abortController.signal);
        this._refreshingSuggestions = false;
        if (abortController.signal.aborted)
            return;

        const prefix = textBeforeCursor.slice(anchor);
        const filtered = filterAndSortSuggestions(suggestions, prefix);
        if (!filtered.length) {
            this._suggestBox?.hide();
            this._suggestBox = null;
            this.suggestionChanged.dispatch();
            return;
        }
        if (autoaccept && filtered.length === 1) {
            this._onPick(filtered[0]);
            return;
        }
        this._anchor = anchor;
        if (!this._suggestBox)
            this._suggestBox = new SuggestBox(this._onPick.bind(this), () => this.suggestionChanged.dispatch());
        this._suggestBox.setSuggestions(prefix, filtered);
        const point = this._editor.pointFromLocation({ line: location.line, column: anchor });
        const rect = this._editor.element.getBoundingClientRect();
        const top = point.y + rect.top;
        const left = point.x + rect.left - 3;
        const bottom = top + this._editor.lineHeight() * .75 + 4;
        this._suggestBox.fit(left, top, bottom);

    }
}

export type Completer = (line: string, abortSignal: AbortSignal) => Promise<{anchor: number, suggestions: Suggestion[]}>;
export type Suggestion = {
    text: string,
    suffix?: string,
    description?: () => Promise<string>,
    activations?: {[key: string]: string},
}
function filterAndSortSuggestions(suggestions: Suggestion[], prefix: string) {
    const filtered = suggestions.filter(s => s.text.startsWith(prefix));
    filtered.sort((a, b) => {
        const underscoresA = /^_*/.exec(a.text)[0].length;
        const underscoreB = /^_*/.exec(b.text)[0].length;
        if (underscoresA !== underscoreB)
            return underscoresA - underscoreB;
        return a.text.localeCompare(b.text);
    });
    return filtered;
}

function filterAndSortSuggestionsSubstringMode(suggestions: string[], prefix: string) {
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