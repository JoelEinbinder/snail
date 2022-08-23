/// <reference path="../../iframe/types.d.ts" />
/// <reference path="../../node_modules/monaco-editor/monaco.d.ts" />
import './index.css';
try {
await loadScript("../../node_modules/monaco-editor/min/vs/loader.js");
async function loadScript(path) {
  const script = document.createElement('script');
  script.src = path;
  script.type = 'text/javascript';
  script.async = false;
  const promise = new Promise(resolve => script.onload = resolve);
  document.head.appendChild(script);
  await promise;
}

(require as any).config({ paths: { vs: '../../node_modules/monaco-editor/min/vs' } });
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

class Header {
  element = document.createElement('div');
  private title = '';
  private modified = false;
  constructor() {
    this.element.classList.add('header');
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
  render() {
    this.element.textContent = this.title + (this.modified ? '*' : '');
  }
}
d4.setIsFullscreen(true);
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
    d4.sendInput(JSON.stringify({method: 'close'}) + '\n');
  }

})
let lastSavedVersion;
while (true){
  const {method, params, id} = await d4.waitForMessage();
  switch(method) {
    case 'setContent': {
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSuggestionDiagnostics: true,
      });
      const language = getLanguage(params.absolutePath);
      const editor = monaco.editor.create(editorContainer, {
        value: params.content,
        language,
        fontSize: 10,
        minimap: {
          enabled: false, 
        },
      });
      lastSavedVersion = editor.getModel()!.getAlternativeVersionId();
      editor.addAction({
        id: 'edit.save',
        label: 'Save',
        run() {
          d4.sendInput(JSON.stringify({method: 'save', params: {content: editor.getValue(), file: params.absolutePath}}) + '\n');
          lastSavedVersion = editor.getModel()!.getAlternativeVersionId();
          header.setModified(lastSavedVersion !== editor.getModel()!.getAlternativeVersionId());
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
      break;
    }
  }
}
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