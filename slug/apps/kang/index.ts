/// <reference path="../../iframe/types.d.ts" />
import './index.css';
import { RPC } from '../../protocol/rpc-js';
import { Editor } from '../../editor/js/editor';

class Header {
  element = document.createElement('div');
  private title = '';
  private _titleElement = document.createElement('div');
  private _closeButton = document.createElement('a');
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
    this.element.append(this._titleElement, this._closeButton);
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
  }
});

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
      lineNumbers: true,
      padBottom: true,
      backgroundColor: '#000',
      colors: {
        cursorColor: '#f4f4f4',
        foreground: '#f4f4f4',
        selectionBackground: '#525252',
        gutterBackground: '#000',
        gutterBorder: 'transparent',
        gutterForeground: '#666',
      }  
    });
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
    editor.on('change', () => {
      header.setModified(lastSavedVersion !== editor.value);
    });
    window.onresize = () => editor.layout();
    header.setTitle(params.relativePath || 'New Buffer');
    editor.layout();
    editor.focus();
  },
});

while (true)
  transport.onmessage!(await d4.waitForMessage<any>());

