/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as Strings from './Strings';
import { ITerminal, IBuffer } from './Types';
import { isMac } from './shared/utils/Browser';
import { RenderDebouncer } from './utils/RenderDebouncer';
import { addDisposableListener } from './utils/Dom';
import { IDisposable } from 'xterm';

const MAX_ROWS_TO_READ = 20;
const ACTIVE_ITEM_ID_PREFIX = 'xterm-active-item-';

enum BoundaryPosition {
  Top,
  Bottom
}

export class AccessibilityManager implements IDisposable {
  private _accessibilityTreeRoot: HTMLElement;
  private _rowContainer: HTMLElement;
  private _rowElements: HTMLElement[] = [];
  private _liveRegion: HTMLElement;
  private _moreRowsElement: HTMLElement;
  private _liveRegionLineCount: number = 0;

  private _renderRowsDebouncer: RenderDebouncer;
  // private _navigationMode: NavigationMode;

  private _topBoundaryFocusListener: (e: FocusEvent) => void;
  private _bottomBoundaryFocusListener: (e: FocusEvent) => void;

  private _disposables: IDisposable[] = [];

  /**
   * This queue has a character pushed to it for keys that are pressed, if the
   * next character added to the terminal is equal to the key char then it is
   * not announced (added to live region) because it has already been announced
   * by the textarea event (which cannot be canceled). There are some race
   * condition cases if there is typing while data is streaming, but this covers
   * the main case of typing into the prompt and inputting the answer to a
   * question (Y/N, etc.).
   */
  private _charsToConsume: string[] = [];

  constructor(private _terminal: ITerminal) {
    this._accessibilityTreeRoot = document.createElement('div');
    this._accessibilityTreeRoot.classList.add('xterm-accessibility');

    this._moreRowsElement = document.createElement('div');
    this._moreRowsElement.classList.add('xterm-message');
    this._moreRowsElement.style.clip = 'clip(0 0 0 0)';
    this._moreRowsElement.textContent = Strings.navigationModeMoreRows;
    this._accessibilityTreeRoot.appendChild(this._moreRowsElement);

    this._rowContainer = document.createElement('div');
    this._rowContainer.classList.add('xterm-accessibility-tree');
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i] = this._createAccessibilityTreeNode();
      this._rowContainer.appendChild(this._rowElements[i]);
    }

    this._topBoundaryFocusListener = e => this._onBoundaryFocus(e, BoundaryPosition.Top);
    this._bottomBoundaryFocusListener = e => this._onBoundaryFocus(e, BoundaryPosition.Bottom);
    this._rowElements[0].addEventListener('focus', this._topBoundaryFocusListener);
    this._rowElements[this._rowElements.length - 1].addEventListener('focus', this._bottomBoundaryFocusListener);

    this._refreshRowsDimensions();
    this._accessibilityTreeRoot.appendChild(this._rowContainer);

    this._renderRowsDebouncer = new RenderDebouncer(this._terminal, this._renderRows.bind(this));
    this._refreshRows();

    this._liveRegion = document.createElement('div');
    this._liveRegion.classList.add('live-region');
    this._liveRegion.setAttribute('aria-live', 'assertive');
    this._accessibilityTreeRoot.appendChild(this._liveRegion);

    this._terminal.element.insertAdjacentElement('afterbegin', this._accessibilityTreeRoot);

    this._disposables.push(this._renderRowsDebouncer);
    this._disposables.push(this._terminal.addDisposableListener('resize', data => this._onResize(data.cols, data.rows)));
    this._disposables.push(this._terminal.addDisposableListener('refresh', data => this._refreshRows(data.start, data.end)));
    this._disposables.push(this._terminal.addDisposableListener('scroll', data => this._refreshRows()));
    // Line feed is an issue as the prompt won't be read out after a command is run
    this._disposables.push(this._terminal.addDisposableListener('a11y.char', (char) => this._onChar(char)));
    this._disposables.push(this._terminal.addDisposableListener('linefeed', () => this._onChar('\n')));
    this._disposables.push(this._terminal.addDisposableListener('a11y.tab', spaceCount => this._onTab(spaceCount)));
    this._disposables.push(this._terminal.addDisposableListener('charsizechanged', () => this._refreshRowsDimensions()));
    this._disposables.push(this._terminal.addDisposableListener('key', keyChar => this._onKey(keyChar)));
    this._disposables.push(this._terminal.addDisposableListener('blur', () => this._clearLiveRegion()));
    // TODO: Maybe renderer should fire an event on terminal when the characters change and that
    //       should be listened to instead? That would mean that the order of events are always
    //       guarenteed
    this._disposables.push(this._terminal.addDisposableListener('dprchange', () => this._refreshRowsDimensions()));
    // This shouldn't be needed on modern browsers but is present in case the
    // media query that drives the dprchange event isn't supported
    this._disposables.push(addDisposableListener(window, 'resize', () => this._refreshRowsDimensions()));
  }

  public dispose(): void {
    this._terminal.element.removeChild(this._accessibilityTreeRoot);
    this._disposables.forEach(d => d.dispose());
    this._disposables = null;
    this._accessibilityTreeRoot = null;
    this._rowContainer = null;
    this._liveRegion = null;
    this._rowContainer = null;
    this._rowElements = null;
  }

  private _onBoundaryFocus(e: FocusEvent, position: BoundaryPosition): void {
    const boundaryElement = <HTMLElement>e.target;
    const beforeBoundaryElement = <HTMLElement>this._rowElements[position === BoundaryPosition.Top ? 1 : this._rowElements.length - 2];

    // Don't scroll if the buffer top has reached the end in that direction
    const posInSet = boundaryElement.getAttribute('aria-posinset');
    const lastRowPos = position === BoundaryPosition.Top ? '1' : `${this._terminal.buffer.lines.length}`;
    if (posInSet === lastRowPos) {
      return;
    }

    // Don't scroll when the last focused item was not the second row (focus is going the other
    // direction)
    if (<HTMLElement>e.relatedTarget !== beforeBoundaryElement) {
      console.log('cancel');
      return;
    }

    // TODO: Refactor to reduce duplication, define top and bottom boundary elements
    let otherBoundaryElement: HTMLElement;
    if (position === BoundaryPosition.Top) {
      // Remove old other boundary element from array
      otherBoundaryElement = this._rowElements.pop();

      // Remove listeners from old boundary elements
      boundaryElement.removeEventListener('focus', this._topBoundaryFocusListener);
      otherBoundaryElement.removeEventListener('focus', this._bottomBoundaryFocusListener);

      // Add new element to array/DOM
      this._rowElements.unshift(this._createAccessibilityTreeNode());
      this._rowContainer.insertAdjacentElement('afterbegin', this._rowElements[0]);

      // Add listeners to new boundary elements
      this._rowElements[0].addEventListener('focus', this._topBoundaryFocusListener);
      this._rowElements[this._rowElements.length - 1].addEventListener('focus', this._bottomBoundaryFocusListener);
    } else {
      // Remove old other boundary element from array
      otherBoundaryElement = this._rowElements.shift();

      // Remove listeners from old boundary elements
      otherBoundaryElement.removeEventListener('focus', this._topBoundaryFocusListener);
      boundaryElement.removeEventListener('focus', this._bottomBoundaryFocusListener);

      // Add new element to array/DOM
      this._rowElements.push(this._createAccessibilityTreeNode());
      this._rowContainer.appendChild(this._rowElements[this._rowElements.length - 1]);

      // Add listeners to new boundary elements
      this._rowElements[0].addEventListener('focus', this._topBoundaryFocusListener);
      this._rowElements[this._rowElements.length - 1].addEventListener('focus', this._bottomBoundaryFocusListener);
    }
    this._rowContainer.removeChild(otherBoundaryElement);

    // Scroll up
    this._terminal.scrollLines(position === BoundaryPosition.Top ? -1 : 1);

    // TODO: Only refresh single
    this._refreshRowsDimensions();

    // Focus new boundary before element
    this._rowElements[position === BoundaryPosition.Top ? 1 : this._rowElements.length - 2].focus();

    // Prevent the standard behavior
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  public get isNavigationModeActive(): boolean {
    // TODO: Remove this function
    return true;
    // return this._navigationMode.isActive;
  }

  public enterNavigationMode(): void {
    // this._navigationMode.enter();

    // this._isNavigationModeActive = true;
    this.announce('Entered line navigation mode');
    // this._rowContainer.tabIndex = 0;
    // this._rowContainer.setAttribute('role', 'list');
    // this._rowContainer.setAttribute('aria-activedescendant', this._activeItemId);
    // this._navigateToElement(this._terminal.buffer.ydisp + this._terminal.buffer.y);
    // this._rowContainer.focus();
    this._rowElements[this._rowElements.length - 1].focus();
  }

  private _onResize(cols: number, rows: number): void {
    // Grow rows as required
    for (let i = this._rowContainer.children.length; i < this._terminal.rows; i++) {
      this._rowElements[i] = this._createAccessibilityTreeNode();
      this._rowContainer.appendChild(this._rowElements[i]);
    }
    // Shrink rows as required
    while (this._rowElements.length > rows) {
      this._rowContainer.removeChild(this._rowElements.pop());
    }

    // TODO: Fix up boundary listeners

    this._refreshRowsDimensions();
  }

  public _createAccessibilityTreeNode(): HTMLElement {
    const element = document.createElement('div');
    element.setAttribute('role', 'listitem');
    element.tabIndex = -1;
    return element;
  }

  private _onTab(spaceCount: number): void {
    for (let i = 0; i < spaceCount; i++) {
      this._onChar(' ');
    }
  }

  private _onChar(char: string): void {
    if (this._liveRegionLineCount < MAX_ROWS_TO_READ + 1) {
      if (this._charsToConsume.length > 0) {
        // Have the screen reader ignore the char if it was just input
        const shiftedChar = this._charsToConsume.shift();
        if (shiftedChar !== char) {
          if (char === ' ') {
            // Always use nbsp for spaces in order to preserve the space between characters in
            // voiceover's caption window
            this._liveRegion.innerHTML += '&nbsp;';
          } else {
            this._liveRegion.textContent += char;
          }
        }
      } else {
        if (char === ' ') {
          this._liveRegion.innerHTML += '&nbsp;';
        } else
        this._liveRegion.textContent += char;
      }

      if (char === '\n') {
        this._liveRegionLineCount++;
        if (this._liveRegionLineCount === MAX_ROWS_TO_READ + 1) {
          this._liveRegion.textContent += Strings.tooMuchOutput;
        }
      }

      // Only detach/attach on mac as otherwise messages can go unaccounced
      if (isMac) {
        if (this._liveRegion.textContent.length > 0 && !this._liveRegion.parentNode) {
          setTimeout(() => {
            this._accessibilityTreeRoot.appendChild(this._liveRegion);
          }, 0);
        }
      }
    }
  }

  private _clearLiveRegion(): void {
    this._liveRegion.textContent = '';
    this._liveRegionLineCount = 0;

    // Only detach/attach on mac as otherwise messages can go unaccounced
    if (isMac) {
      if (this._liveRegion.parentNode) {
        this._accessibilityTreeRoot.removeChild(this._liveRegion);
      }
    }
  }

  private _onKey(keyChar: string): void {
    this._clearLiveRegion();
    this._charsToConsume.push(keyChar);
  }

  private _refreshRows(start?: number, end?: number): void {
    this._renderRowsDebouncer.refresh(start, end);
  }

  private _renderRows(start: number, end: number): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    const setSize = (buffer.lines.length).toString();
    for (let i = start; i <= end; i++) {
      const lineData = buffer.translateBufferLineToString(buffer.ydisp + i, true);
      this._rowElements[i].textContent = lineData.length === 0 ? 'Blank line' : lineData;
      const posInSet = (buffer.ydisp + i + 1).toString();
      this._rowElements[i].setAttribute('aria-posinset', posInSet);
      this._rowElements[i].setAttribute('aria-setsize', setSize);
    }
    // TODO: Clean up
  }

  public rotateRows(): void {
    // this._rowContainer.removeChild(this._rowElements.shift());
    // const newRowIndex = this._rowElements.length;
    // this._rowElements[newRowIndex] = this._createAccessibilityTreeNode();
    // this._rowContainer.appendChild(this._rowElements[newRowIndex]);
    // this._refreshRowsDimensions();
  }

  private _refreshRowsDimensions(): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    const dimensions = this._terminal.renderer.dimensions;
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i].style.height = `${dimensions.actualCellHeight}px`;
    }
  }

  public announce(text: string): void {
    this._clearLiveRegion();
    this._liveRegion.textContent = text;
  }
}
