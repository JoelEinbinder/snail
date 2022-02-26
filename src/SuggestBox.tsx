import React from 'react';
import {Viewport} from './Viewport';
import './suggestions.css';
import { Suggestion } from './autocomplete';
import { GlassPlane } from './GlassPane';
export class SuggestBox {
    element: HTMLElement;
    private _selectedSuggestion: Suggestion|undefined;
    private _suggestions: Suggestion[] = [];
    private _prefix: string = '';
    private _glassPane: GlassPlane;
    private _viewport = new Viewport<Suggestion>(14, 14 * 9, this._renderItem.bind(this));
    private _description = document.createElement('div');
    constructor(private _onPick: (suggestion: Suggestion) => void, private _onSelectionChanged: () => void) {
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

    setSuggestions(prefix: string, suggestions: Suggestion[]) {
        if (!suggestions.includes(this._selectedSuggestion))
            delete this._selectedSuggestion;
        this._suggestions = suggestions;
        this._prefix = prefix;
        this._viewport.setItems(suggestions);
        if (!this._viewport.isItemFullyVisible(this._selectedSuggestion || this._suggestions[0]))
            this._viewport.showItem(this._selectedSuggestion || this._suggestions[0], 'up');
        this._refreshDescription();
        this._onSelectionChanged();
    }
    private _render() {
        this._viewport._refresh();
    }
    private _renderItem(suggestion: Suggestion) {
        const isSelected = this._selectedSuggestion ? this._selectedSuggestion === suggestion : this._suggestions[0] === suggestion;
        const prefix = this._prefix;
        return <div title={suggestion.text} onMouseDown={() => this._onPick(suggestion)} className={`suggestion ${isSelected ? 'selected' : ''}`}>
            <span style={{textShadow: '0.5px 0 0 currentColor', color: '#FFF', lineHeight: '14px'}}>{prefix}</span>
            {suggestion.text.substring(prefix.length)}
            <span style={{ color: 'var(--ansi-246 )'}}>{suggestion.suffix}</span>
        </div>
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
            case 'Enter':
                const prefix = this._prefix;
                this._onPick(suggestion);
                return prefix !== suggestion.text;
            case 'Tab':
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
        this._description.textContent = '';
        if (!selected || !selected.description)
            return;
        const description = await selected.description();
        if (selected !== (this._selectedSuggestion || this._suggestions[0]))
            return;
        this._description.textContent = description;
    }
    hide() {
        this._glassPane.hide();
    }
    fit(x: number, top: number, bottom: number) {
        const availableRect = this._glassPane.availableRect();
        this._glassPane.show();
        const rect = this.element.getBoundingClientRect();
        const overflowTop = availableRect.top - (top - rect.height);
        const overflowBottom = (bottom + rect.height) - availableRect.bottom + availableRect.top;
        if (overflowBottom <= 0 || (overflowBottom < overflowTop))
            this._glassPane.position(x, bottom);
        else
            this._glassPane.position(x, top - rect.height);
    }
}
