import './split.css';

export class Split {
    element = document.createElement('div');
    first = document.createElement('div');
    second = document.createElement('div');

    private _ratio: number;
    private _vertical: boolean | undefined;
    private _gutter = document.createElement("div");
    constructor(vertical?: boolean, ratio?: number) {
        this.element.classList.add("split");
        this._ratio = ratio || 0.5;
        this._vertical = vertical;
        this.element.classList.toggle(this._vertical ? "vertical" : "horizontal", true);
        this.first.classList.add("left");
        this.second.classList.add("right");
        this._gutter.classList.add("gutter");
        this.element.append(this.first, this._gutter, this.second);
        this._gutter.draggable = true;
        this._gutter.tabIndex = 0;
        this._gutter.addEventListener("dragstart", event => {
            event.preventDefault();
            event.stopPropagation();
        }, false);
        var mouseIsDown = false;
        this._gutter.addEventListener('mousedown', event => {
            mouseIsDown = true;
            this.first.style.pointerEvents = 'none';
            this.second.style.pointerEvents = 'none';
        }, false);
        this.element.addEventListener('mouseup', event => {
            mouseIsDown = false;
            this.first.style.removeProperty('pointer-events');
            this.second.style.removeProperty('pointer-events');
        }, false);
        this._gutter.addEventListener('blur', event => {
            mouseIsDown = false;
            this.first.style.removeProperty('pointer-events');
            this.second.style.removeProperty('pointer-events');
        }, false);
        this.element.addEventListener('mousemove', event => {
            if (!mouseIsDown)
                return;
            var rect = this.element.getBoundingClientRect();
            if (this._vertical)
                this.updateRatio((event.clientY - rect.top) / rect.height);
            else
                this.updateRatio((event.clientX - rect.left) / rect.width);
        }, false);
        this._gutter.addEventListener('keydown', event => {
            switch (event.key) {
                case "Left":
                case "ArrowLeft":
                case "Up":
                case "ArrowUp":
                    this.updateRatio(this._ratio - 0.01);
                    break;
                case "Right":
                case "ArrowRight":
                case "Down":
                case "ArrowDown":
                    this.updateRatio(this._ratio + 0.01);
                    break;
                default: return;
            }
            event.preventDefault();
            event.stopPropagation();
        }, false);
        this.updateRatio(this._ratio);
    }
    updateRatio(newRatio: number) {
        this._ratio = Math.max(Math.min(newRatio, 0.9), 0.1);
        if (this._vertical) {
            this.second.style.top = this._gutter.style.top = this.first.style.height = (this._ratio * 100) + '%';
            this.first.style.bottom = ((1 - this._ratio) * 100) + '%';
        }
        else {
            this.second.style.left = this._gutter.style.left = this.first.style.width = (this._ratio * 100) + '%';
            this.first.style.right = ((1 - this._ratio) * 100) + '%';
        }
    }

    get ratio() {
        return this._ratio;
    }
}
