import * as snail from '../../sdk/web';
/// <reference path="../../../node_modules/monaco-editor/monaco.d.ts" />
import './index.css';
import { RPC } from '../../sdk/rpc-js';
try {
await loadScript("./vs/loader.js");
async function loadScript(path) {
  const script = document.createElement('script');
  script.src = path;
  script.type = 'text/javascript';
  script.async = false;
  const promise = new Promise(resolve => script.onload = resolve);
  document.head.appendChild(script);
  await promise;
}

(require as any).config({ paths: { vs: './vs' } });
await new Promise(x => (require as any)(['vs/editor/editor.main'], x));
monaco.editor.defineTheme('my-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#111111'
  }
})
monaco.editor.setTheme('my-dark');

monaco.languages.register({
  id: 'git-commit',
  filenames: ['COMMIT_EDITMSG'],
  
});
monaco.languages.setMonarchTokensProvider('git-commit', {
	defaultToken: '',

	keywords: [],

	brackets: [
		{ open: '{', close: '}', token: 'delimiter.curly' },
		{ open: '[', close: ']', token: 'delimiter.bracket' },
		{ open: '(', close: ')', token: 'delimiter.parenthesis' }
	],

	tokenizer: {
		root: [
			[/^#.*$/, 'comment'],
		],
  }
});
monaco.languages.setLanguageConfiguration('git-commit', {
	"comments": {
		"lineComment": "#",
		"blockComment": [ "#", " " ]
	},
	"brackets": [
		["{", "}"],
		["[", "]"],
		["(", ")"]
	]
});
monaco.languages.register({
  id: 'shjs',
  extensions: ['.shjs'],
});

monaco.languages.registerTokensProviderFactory('shjs', {
  async create() {
    const {createTokenizer} = await import('./shjsTokenizer');
    return createTokenizer();
  }
})

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
snail.setIsFullscreen(true);
snail.expectingUserInput('edit');
snail.setToJSON(() => {
  if (!editor)
    return 'Loading...';
  return {
    title: header.element.textContent,
    content: editor.getValue(),
  }
});

snail.setActions(() => {
  if (!editor)
    return [];
  function monacoShortcutToSnailShortcut(parts) {
    return parts.map(p => {
      let key = '';
      if (p.ctrlKey)
        key += 'Ctrl+';
      if (p.shiftKey)
        key += 'Shift+';
      if (p.altKey)
        key += 'Alt+';
      if (p.metaKey)
        key += 'Meta+';
      key += p.keyLabel;
      return key;
    }).join(' ');
  }
  function monacoActionToSnailAction(action) {
    const binding = editor._standaloneKeybindingService.lookupKeybinding(action.id);
    return {
      title: `Edit: ${action.label}`,
      id: 'edit.' + action.id,
      shortcut: binding ? monacoShortcutToSnailShortcut(binding.getParts()) : undefined,
      callback: () => action.run(),
    }
  }
  return editor.getActions().map(action => monacoActionToSnailAction(action));
});

let initialDocumentLoad: (() => void) | null = snail.startAsyncWork('initial document load');
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
  snail.startAsyncWork('closing editor');
  rpc.notify('close', {});
}
let lastSavedVersion;
let editor: monaco.editor.IStandaloneCodeEditor;
let relativePath: string;
const transport: Parameters<typeof RPC>[0] = {
  send(message) {
    snail.sendInput(JSON.stringify(message) + '\n');
  },
};
const rpc = RPC(transport, {
  async setContent(params) {
    if (initialDocumentLoad) {
      console.log('initial document load done')
      initialDocumentLoad();
      initialDocumentLoad = null;
    }
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSuggestionDiagnostics: true,
    });
    const language = getLanguage(params.absolutePath);
    relativePath = params.relativePath;
    editor = monaco.editor.create(editorContainer, {
      value: params.content,
      language,
      fontSize: parseInt(window.getComputedStyle(document.body).fontSize),
      fontFamily: window.getComputedStyle(document.body).fontFamily,
      wordBasedSuggestions: false,
      minimap: {
        enabled: false, 
      },
    });
    lastSavedVersion = editor.getModel()!.getAlternativeVersionId();
    editor.addAction({
      id: 'edit.save',
      label: 'Save',
      async run() {
        lastSavedVersion = editor.getModel()!.getAlternativeVersionId();
        const done = snail.startAsyncWork('save');
        await rpc.send('save', {content: editor.getValue(), file: params.absolutePath });
        header.setModified(lastSavedVersion !== editor.getModel()!.getAlternativeVersionId());
        done();
      },
      contextMenuGroupId: 'file',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    });
    editor.getModel()!.onDidChangeContent(() => {
      header.setModified(lastSavedVersion !== editor.getModel()!.getAlternativeVersionId());
    });
    window.onresize = () => editor.layout();
    header.setTitle(params.relativePath || 'New Buffer');
    editor.layout();
    editor.focus();
    setTimeout(() => {
      editor.setScrollTop(0, monaco.editor.ScrollType.Immediate);
    }, 0);
  },
});
window.addEventListener('focus', () => {
  if (document.activeElement !== document.body)
    return;
  editor?.focus();
});
while (true)
  transport.onmessage!(await snail.waitForMessage<any>());
} catch (e) {
  console.error(e);
}
function getLanguage(filePath: string) {
  const extension = '.' + filePath.split('.').pop();
  const file = filePath.split('/').pop();
  return monaco.languages.getLanguages().find(a => {
    return a.filenames?.includes(file!) || a.extensions?.includes(extension)
  })?.id;
}