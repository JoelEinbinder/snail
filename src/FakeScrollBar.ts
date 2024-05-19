import './fakeScrollBar.css';

export class FakeScrollBar {
    public element = document.createElement('div');
    private _track = document.createElement('div');
    private _cursor: { x: number, y: number} | null = null;
    constructor(private _scroller: HTMLElement) {
        this.element.classList.add('fake-scroll-bar');
        this._track.classList.add('track');
        this.element.append(this._track);
        
        this._updateTrack();
        this._scroller.addEventListener('scroll', () => {
            this._updateTrack();
        });
        new ResizeObserver(() => {
            this._updateTrack();
        }).observe(this._scroller);

        
        this._track.addEventListener('mousedown', event => {
            const dragStart = event.clientY;
            const scrollTopStart = this._scroller.scrollTop;
            // We have to listen on the window so that you can select outside the bounds
            const window = this._track.ownerDocument.defaultView!;
            const mousemove: (arg0: MouseEvent) => void = (event): void => {
                const absoluteDelta = event.clientY - dragStart;
                const percentDelta = absoluteDelta / this.element.getBoundingClientRect().height;
                this._scroller.scrollTop = scrollTopStart + percentDelta * this._scroller.scrollHeight;
            };
            const mouseup: (arg0: MouseEvent) => void = (event): void => {
                window.removeEventListener('mousemove', mousemove, true);
                window.removeEventListener('mouseup', mouseup, true);
                document.body.classList.remove('active-scroll');
            };
            document.body.classList.add('active-scroll');
            window.addEventListener('mousemove', mousemove, true);
            window.addEventListener('mouseup', mouseup, true);
            event.preventDefault();
            event.stopImmediatePropagation();
        });      
    }
    _updateTrack() {
        if (this._scroller.scrollHeight <= this._scroller.clientHeight) {
            this.element.style.display = 'none';
            return;
        }
        this.element.style.removeProperty('display');
        const top = this._scroller.scrollTop / this._scroller.scrollHeight;
        const bottom = (this._scroller.scrollTop + this._scroller.clientHeight) / this._scroller.scrollHeight;
        this._track.style.top = Math.max(0,(Math.min(top, bottom - 0.02) * 100)).toFixed(5) + '%';
        this._track.style.bottom = Math.max(0, ((1 - Math.max(bottom, top + 0.02)) * 100)).toFixed(5) + '%';
        this.element.classList.add('scrolled-now');
        this._track.offsetHeight;
        this.element.classList.remove('scrolled-now');
    }
}