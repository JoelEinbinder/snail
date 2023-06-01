/// <reference path="../../iframe/types.d.ts" />
import './web.css';
import { RPC } from '../../protocol/rpc-js';
import { Editor } from '../../editor/js/editor';
import '../../editor/modes/javascript';
import '../../editor/modes/python';
import './fake-mode';
class Header {
  element = document.createElement('div');
  private title = '';
  private _titleElement = document.createElement('div');
  private _closeButton = document.createElement('a');
  private _loadingSpinner = document.createElement('div');
  private modified = false;
  constructor() {
    this.element.classList.add('header');
    this._titleElement.classList.add('title');
    this._closeButton.role = 'button';
    this._closeButton.tabIndex = 0;
    this._closeButton.title = 'Close (⌃X)'
    this._closeButton.setAttribute('aria-label', this._closeButton.title);
    this._closeButton.classList.add('codicon','codicon-close', 'close');
    this._closeButton.onclick = event => {
      event.stopImmediatePropagation();
      event.preventDefault();
      doClose();
    };
    this._loadingSpinner.classList.add('lds-dual-ring');
    this.element.append(this._titleElement, this._loadingSpinner, this._closeButton);
  }
  setTitle(title: string) {
    this.title = title;
    this.render();
  }
  setModified(modified: boolean) {
    if (this.modified == modified)
      return;
    this.modified = modified;
    this.render();
  }
  isModified()  {
    return this.modified;
  }
  render() {
    this._titleElement.textContent = this.title + (this.modified ? '*' : '');
  }
  setIsLoading(loading: boolean) {
    this.element.classList.toggle('loading', loading);
  }
}
d4.setIsFullscreen(true);
d4.expectingUserInput('edit');
d4.setToJSON(() => {
  if (!editor)
    return 'Loading...';
  return {
    title: header.element.textContent,
    content: editor.value,
  }
});
let initialDocumentLoad: (() => void) | null = d4.startAsyncWork('initial document load');
document.title = 'foo';
const header = new Header();
document.body.append(header.element);
const editorContainer = document.createElement('div');
editorContainer.classList.add('editor-container');
document.body.append(editorContainer);
document.addEventListener('keydown', event => {
  if ((event.code === 'KeyX' || event.code === 'KeyC') && event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();
    doClose();
  } else if (event.code === 'KeyG' && event.ctrlKey) {
    updateEditorMode(!inLanguageMode);
    event.preventDefault();
    event.stopPropagation();
  }
});

let inLanguageMode = false;
let tokens: { text: string, color?: string, hover?: string }[] = [];
function updateEditorMode(inl: boolean) {
  inLanguageMode = inl;
  if (!editor)
    return;
  if (inLanguageMode) {
    const ext = relativePath.split('.').pop();
    editor.setModeOptions({actualLang: ext, indentUnit: 4});
  } else {
    editor.setModeOptions({
      tokens,
    });
  }
}

function doClose() {
  if (editor && header.isModified()) {
    if (!confirm(`Discard unsaved changes to ${relativePath}?`))
      return;
  }
  // this will be handled by the iframe destruction
  d4.startAsyncWork('closing editor');
  rpc.notify('close', {});
}
let lastSavedVersion;
let editor: Editor;
let relativePath: string;
const transport: Parameters<typeof RPC>[0] = {
  send(message) {
    d4.sendInput(JSON.stringify(message) + '\n');
  },
};
const rpc = RPC(transport, {
  async setContent(params) {
    if (initialDocumentLoad) {
      console.log('initial document load done')
      initialDocumentLoad();
      initialDocumentLoad = null;
    }
    relativePath = params.relativePath;
    editor = new Editor(params.content, {
      language: '<fake>',
      lineNumbers: true,
      padBottom: true,
      backgroundColor: '#000',
    });
    window['editorForTest'] = editor;
    updateEditorMode(true);
    editorContainer.append(editor.element);
    editor.layout();
    lastSavedVersion = editor.value;
    editorContainer.addEventListener('keydown', async event => {
      if (event.code === 'KeyS' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        lastSavedVersion = editor.value;
        const done = d4.startAsyncWork('save');
        await rpc.send('save', {content: editor.value, file: params.absolutePath });
        header.setModified(lastSavedVersion !== editor.value);
        done();
      }
    });
    editor.on('change', async ({range, text}) => {
      header.setModified(lastSavedVersion !== editor.value);
      const cursor = { column: 0, line: 0 };
      let start;
      let end;
      outer: for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        for (let j = 0; j < token.text.length; j++) {
          if (cursor.line === range.start.line && cursor.column === range.start.column) {
            start = { token: i, offset: j };
          }
          if (cursor.line === range.end.line && cursor.column === range.end.column) {
            end = { token: i, offset: j };
            break outer;
          }
          if (token.text[j] === '\n') {
            cursor.column = 0;
            cursor.line++;
          } else {
            cursor.column++;
          }
        }
      }
      if (start && end) {
        const newToken = {
          text: tokens[start.token].text.slice(0, start.offset) + text + tokens[end.token].text.slice(end.offset),
          color: tokens[start.token]?.color,
        };
        tokens.splice(start.token, end.token - start.token + 1, newToken);
      } else {
        tokens = [];
      }
      requestHighlight();
    });
    window.onresize = () => editor.layout();
    header.setTitle(params.relativePath || 'New Buffer');
    editor.layout();
    editor.focus();
    requestHighlight();
  }
});

let lastHighlight = '';
async function requestHighlight() {
  const content = editor.value;
  if (content === lastHighlight)
    return;
  header.setIsLoading(true);
  const highlightedTokens = await rpc.send('highlight', {content: editor.value});
  if (content !== editor.value)
    return;
  header.setIsLoading(false);
  lastHighlight = content;
  tokens = highlightedTokens;
  updateEditorMode(inLanguageMode);
}
while (true)
  transport.onmessage!(await d4.waitForMessage<any>());

