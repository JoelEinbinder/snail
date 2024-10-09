import {Viewport} from './Viewport';
import './suggestions.css';
import { Suggestion } from './autocomplete';
import { GlassPlane } from './GlassPane';
import { font } from './font';
export class SuggestBox {
    element: HTMLElement;
    private _selectedSuggestion: Suggestion|undefined;
    private _suggestions: Suggestion[] = [];
    private _prefix: string = '';
    private _glassPane: GlassPlane;
    private _triggerHappy: boolean;
    private _viewport = new Viewport<Suggestion>(font.current.size * 1.4, 9, this._renderItem.bind(this));
    private _description = document.createElement('div');
    constructor(private _onPick: (suggestion: Suggestion) => boolean, private _onSelectionChanged: () => void) {
        this.element = document.createElement('div');
        this.element.classList.add('suggest-popup');
        this._description.classList.add('description');
        this.element.append(this._viewport.element);
        this.element.append(this._description);
        this._glassPane = new GlassPlane(this.element);
        this._viewport.element.classList.add('suggestions');
    }
    get showing() {
        return this._glassPane.showing();
    }
    get selectedIndex() {
        return this._selectedSuggestion ? this._suggestions.indexOf(this._selectedSuggestion) : -1;
    }

    get currentSuggestion() {
        return this._selectedSuggestion ? this._selectedSuggestion : this._suggestions[0];
    }
    setTriggerHappy(triggerHappy: boolean) {
        this._triggerHappy = triggerHappy;
    }

    setSuggestions(prefix: string, suggestions: Suggestion[], cssTag?: string) {
        if (!suggestions.includes(this._selectedSuggestion))
            delete this._selectedSuggestion;
        this._suggestions = suggestions;
        this._prefix = prefix;
        this._viewport.setItems(suggestions);
        if (!this._viewport.isItemFullyVisible(this._selectedSuggestion || this._suggestions[0]))
            this._viewport.showItem(this._selectedSuggestion || this._suggestions[0], 'up');
        if (cssTag)
            this.element.setAttribute('data-css-tag', cssTag);
        else
            this.element.removeAttribute('data-css-tag');
        this._refreshDescription();
        this._onSelectionChanged();
        this._glassPane.resized();
    }
    private _render() {
        this._viewport._refresh();
    }
    private _renderItem(suggestion: Suggestion) {
        const isSelected = this._selectedSuggestion ? this._selectedSuggestion === suggestion : this._suggestions[0] === suggestion;
        const prefix = this._prefix;
        const suggestionDiv = document.createElement('div');
        suggestionDiv.classList.add('suggestion');
        suggestionDiv.classList.toggle('selected', isSelected);
        suggestionDiv.title = suggestion.text;
        suggestionDiv.classList.toggle('psuedo', !!suggestion.psuedo);
        suggestionDiv.addEventListener('mousedown', () => this._onPick(suggestion));

        const parts = suggestion.text.toLowerCase().split(prefix.toLowerCase());
        let i = 0;
        for (const part of parts) {
            if (part.length) {
                suggestionDiv.append(suggestion.text.slice(i, i + part.length));
                i += part.length;
            }
            if (prefix.length) {
                const prefixSpan = document.createElement('span');
                prefixSpan.classList.add('prefix');
                prefixSpan.textContent = suggestion.text.slice(i, i + prefix.length);
                suggestionDiv.append(prefixSpan);
                i += prefix.length;
            }
        }

        const suffixSpan = document.createElement('span');
        suffixSpan.classList.add('suffix');
        suffixSpan.textContent = suggestion.suffix;
        suggestionDiv.append(suffixSpan);
        return suggestionDiv;
    }
    onKeyDown(event: KeyboardEvent): boolean {
        const suggestion = this._selectedSuggestion || this._suggestions[0];
        if (suggestion.activations && event.key in suggestion.activations) {
            this._onPick({text: suggestion.activations[event.key]});
            return true;
        }
        switch(event.key) {
            case 'ArrowUp':
                this._moveSelection(-1);
                return true;
            case 'ArrowDown':
                this._moveSelection(1);
                return true;
            case 'ArrowRight':
            case 'End':
                return this._onPick(suggestion);
            case 'Enter':
                const result = this._onPick(suggestion);
                return result && !this._triggerHappy;
            case 'Tab':
                if (suggestion.psuedo)
                    this._onPick(this._suggestions[1]);
                else
                    this._onPick(suggestion);
                return true;
        }
        return false;
    }
    private _moveSelection(amount: number) {
        const index = this._selectedSuggestion ? this._suggestions.indexOf(this._selectedSuggestion) : 0;
        const newIndex = (this._suggestions.length + index + amount) % this._suggestions.length;
        this._selectedSuggestion = this._suggestions[newIndex];
        this._refreshDescription();
        this._onSelectionChanged();
        this._render();
        this._viewport.showItem(this._suggestions[newIndex], amount > 0 ? 'down' : 'up');
    }
    private async _refreshDescription() {
        const selected = this._selectedSuggestion || this._suggestions[0];
        if (!selected || !selected.description) {
            this._description.textContent = '';
            return;
        }
        const description = await selected.description();
        if (selected !== (this._selectedSuggestion || this._suggestions[0])) {
            this._description.textContent = '';
            return;
        }
        this._description.textContent = description;
        this._glassPane.resized();
    }
    hide() {
        this._glassPane.hide();
    }
    fit(x: number, top: number, bottom: number) {
        this._glassPane.show();
        this._glassPane.position(x, top, bottom);
    }

    serializeForTest() {
        return this._suggestions.map(x => x.text);
    }
}
