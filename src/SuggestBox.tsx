import React from 'react';
import {Viewport} from './Viewport';
import './suggestions.css';
import { Suggestion } from './autocomplete';

export class SuggestBox {
    element: HTMLElement;
    private _selectedSuggestion: Suggestion|undefined;
    private _suggestions: Suggestion[] = [];
    private _prefix: string = '';
    private _viewport = new Viewport<Suggestion>(14, 14 * 9, this._renderItem.bind(this));
    constructor(window: Window, private _onPick: (suggestion: Suggestion) => void) {
        this.element = window.document.createElement('div');
        this.element.style.position = 'fixed';
        this.element.style.top = '0';
        this.element.style.left = '0';
        this.element.appendChild(this._viewport.element);
        this._viewport.element.classList.add('suggestions');
    }
    get showing() {
        return !!this.element.parentElement;
    }
    setSuggestions(prefix: string, suggestions: Suggestion[]) {
        if (!suggestions.includes(this._selectedSuggestion))
            delete this._selectedSuggestion;
        this._suggestions = suggestions;
        this._prefix = prefix;
        this._viewport.setItems(suggestions);
        if (!this._viewport.isItemFullyVisible(this._selectedSuggestion || this._suggestions[0]))
            this._viewport.showItem(this._selectedSuggestion || this._suggestions[0], 'up');
    }
    _render() {
        this._viewport._refresh();
    }
    _renderItem(suggestion: Suggestion) {
        const isSelected = this._selectedSuggestion ? this._selectedSuggestion === suggestion : this._suggestions[0] === suggestion;
        const prefix = this._prefix;
        return <div title={suggestion.text} onMouseDown={() => this._onPick(suggestion)} className={`suggestion ${isSelected ? 'selected' : ''}`}>
            <span style={{textShadow: '0.5px 0 0 currentColor', color: '#FFF', lineHeight: '14px'}}>{prefix}</span>{suggestion.text.substring(prefix.length)}
        </div>
    }
    onKeyDown(event: KeyboardEvent): boolean {
        switch(event.key) {
            case 'ArrowUp':
                this._moveSelection(-1);
                return true;
            case 'ArrowDown':
                this._moveSelection(1);
                return true;
            case 'Enter':
                const suggestion = this._selectedSuggestion || this._suggestions[0];
                const prefix = this._prefix;
                this._onPick(suggestion);
                return prefix !== suggestion.text;
            case 'Tab':
                this._onPick(this._selectedSuggestion || this._suggestions[0]);
                return true;
        }
        return false;
    }
    _moveSelection(amount: number) {
        const index = this._selectedSuggestion ? this._suggestions.indexOf(this._selectedSuggestion) : 0;
        const newIndex = (this._suggestions.length + index + amount) % this._suggestions.length;
        this._selectedSuggestion = this._suggestions[newIndex];
        this._render();
        this._viewport.showItem(this._suggestions[newIndex], amount > 0 ? 'down' : 'up');
    }
    hide() {
        this.element.remove();
    }
    fit(x: number, top: number, bottom: number, availableRect: { top: number, left: number, bottom: number, right: number }) {
        if (!this.element.parentElement)
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
