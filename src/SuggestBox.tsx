import {render} from 'react-dom';
import React from 'react';
import {Suggestions} from './Suggestions';
export class SuggestBox {
    element: HTMLElement;
    private _selectedSuggestion: string|undefined;
    private _suggestions: string[] = [];
    private _prefix: string = '';
    constructor(window: Window, private _onPick: (suggestion: string) => void) {
        this.element = window.document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.top = '0';
        this.element.style.left = '0';
    }
    get showing() {
        return !!this.element.parentElement;
    }
    setSuggestions(prefix: string, suggestions: string[]) {
        if (!suggestions.includes(this._selectedSuggestion))
            delete this._selectedSuggestion;
        this._suggestions = suggestions;
        this._prefix = prefix;
        this._render();
    }
    _render() {
        render(<Suggestions
            prefix={this._prefix}
            suggestions={this._suggestions}
            selected={this._selectedSuggestion || this._suggestions[0]}
            onPick={this._onPick}
        />, this.element);
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
