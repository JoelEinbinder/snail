/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, ISelectionManager } from '../Types';

interface IWindow extends Window {
  clipboardData?: {
    getData(format: string): string;
    setData(format: string, data: string): void;
  };
}

declare var window: IWindow;

/**
 * Prepares text to be pasted into the terminal by normalizing the line endings
 * @param text The pasted text that needs processing before inserting into the terminal
 */
export function prepareTextForTerminal(text: string): string {
  return text.replace(/\r?\n/g, '\r');
}

/**
 * Bracket text for paste, if necessary, as per https://cirw.in/blog/bracketed-paste
 * @param text The pasted text to bracket
 */
export function bracketTextForPaste(text: string, bracketedPasteMode: boolean): string {
  if (bracketedPasteMode) {
    return '\x1b[200~' + text + '\x1b[201~';
  }
  return text;
}

/**
 * Binds copy functionality to the given terminal.
 * @param {ClipboardEvent} ev The original copy event to be handled
 */
export function copyHandler(ev: ClipboardEvent, term: ITerminal, selectionManager: ISelectionManager): void {
  if (term.browser.isMSIE) {
    window.clipboardData.setData('Text', selectionManager.selectionText);
  } else {
    ev.clipboardData.setData('text/plain', selectionManager.selectionText);
  }

  // Prevent or the original text will be copied.
  ev.preventDefault();
}

/**
 * Redirect the clipboard's data to the terminal's input handler.
 * @param {ClipboardEvent} ev The original paste event to be handled
 * @param {Terminal} term The terminal on which to apply the handled paste event
 */
export function pasteHandler(ev: ClipboardEvent, term: ITerminal): void {
  ev.stopPropagation();

  let text: string;

  const dispatchPaste = function(text: string): void {
    text = prepareTextForTerminal(text);
    text = bracketTextForPaste(text, term.bracketedPasteMode);
    term.handler(text);
    term.textarea.value = '';
    term.emit('paste', text);
    term.cancel(ev);
  };

  if (term.browser.isMSIE) {
    if (window.clipboardData) {
      text = window.clipboardData.getData('Text');
      dispatchPaste(text);
    }
  } else {
    if (ev.clipboardData) {
      text = ev.clipboardData.getData('text/plain');
      dispatchPaste(text);
    }
  }
}

/**
 * Moves the textarea under the mouse cursor and focuses it.
 * @param ev The original right click event to be handled.
 * @param textarea The terminal's textarea.
 */
export function moveTextAreaUnderMouseCursor(ev: MouseEvent, textarea: HTMLTextAreaElement): void {
  // Bring textarea at the cursor position
  textarea.style.position = 'fixed';
  textarea.style.width = '20px';
  textarea.style.height = '20px';
  textarea.style.left = (ev.clientX - 10) + 'px';
  textarea.style.top = (ev.clientY - 10) + 'px';
  textarea.style.zIndex = '1000';

  textarea.focus();

  // Reset the terminal textarea's styling
  // Timeout needs to be long enough for click event to be handled.
  setTimeout(() => {
    textarea.style.position = null;
    textarea.style.width = null;
    textarea.style.height = null;
    textarea.style.left = null;
    textarea.style.top = null;
    textarea.style.zIndex = null;
  }, 200);
}

/**
 * Bind to right-click event and allow right-click copy and paste.
 * @param ev The original right click event to be handled.
 * @param textarea The terminal's textarea.
 * @param selectionManager The terminal's selection manager.
 * @param shouldSelectWord If true and there is no selection the current word will be selected
 */
export function rightClickHandler(ev: MouseEvent, textarea: HTMLTextAreaElement, selectionManager: ISelectionManager, shouldSelectWord: boolean): void {
  moveTextAreaUnderMouseCursor(ev, textarea);

  if (shouldSelectWord && !selectionManager.isClickInSelection(ev)) {
    selectionManager.selectWordAtCursor(ev);
  }

  // Get textarea ready to copy from the context menu
  textarea.value = selectionManager.selectionText;
  textarea.select();
}
