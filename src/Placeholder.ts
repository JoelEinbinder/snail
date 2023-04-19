import type { Action } from "./actions";
import type { Block, BlockDelegate } from "./GridPane";
import './placeholder.css';

export class Placeholder implements Block {
    private _element = document.createElement('div');
    blockDelegate?: BlockDelegate;
    constructor(title: string) {
        this._element.classList.add('placeholder');
        this._element.tabIndex = 0;
        this._element.textContent = title;
    }
    close(): void {
    }
    hide(): void {
        this._element.remove();
    }
    show(): void {
        document.body.append(this._element);
    }
    updatePosition(rect: { x: number; y: number; width: number; height: number; }): void {
        this._element.style.left = rect.x + 'px';
        this._element.style.top = rect.y + 'px';
        this._element.style.width = rect.width + 'px';
        this._element.style.height = rect.height + 'px';        
    }
    focus(): void {
        this._element.focus();
    }
    hasFocus(): boolean {
        return this._element.ownerDocument.activeElement == this._element;
    }
    title(): string {
        return this._element.textContent;
    }
    async serializeForTest(): Promise<any> {
        return { type: 'placeholder', title: this._element.textContent };
    }
    actions(): Action[] {
        return [];
    }
    async asyncActions(): Promise<Action[]> {
        return [];
    }
}
