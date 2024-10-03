import { Editor } from "../slug/editor/js/editor";
import { Autocomplete, Completer } from "./autocomplete";
import type { Language, Shell } from "./Shell";
import '../slug/shjs/editorMode';
import '../slug/editor/modes/python';
import '../slug/editor/modes/shell';
import '../slug/editor/modes/javascript';
import { makeJSCompleter, makeShellCompleter } from "./shellCompleter";
import './completions/git';
import './completions/npx';
import './completions/npm';
import './completions/nvm';
import './completions/apt';
import './completions/docker';
import './completions/ai_model';
import { setSelection } from "./selection";
import { host } from "./host";
import { makeHistoryCompleter } from "./historyCompleter";
import { themeEditorColors } from "./theme";
import { startAsyncWork } from "./async";
import { makePythonCompleter } from "./pythonCompleter";
import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
const languageToMode: {[key in Language]: string} = {
  'shjs': 'shjs',
  'javascript': 'js',
  'python': 'py',
  'bash': 'sh',
};

export function makePromptEditor(shell: Shell, languageEvent: JoelEvent<Language>) {
  const editor = new Editor('', {
    inline: true,
    lineNumbers: false,
    language: languageToMode[languageEvent.current],
    padding: 0,
    wordWrap: true,
    colors: themeEditorColors(),
    useTabs: true,
  });
  shell.globalVars().then(globalVars => {
    editor.setModeOptions({globalVars});
  })
  const autocomplete = new Autocomplete(editor, {
    shjs: makeShellCompleter(shell),
    py: makePythonCompleter(shell),
    js: makeJSCompleter(shell),
  }, ' /.', {
    'KeyR': makeHistoryCompleter(shell),
  });
  let historyIndex = 0;
  let currentValue = '';
  let currentLanguage = languageEvent.current;
  editor.on('selection-changed', () => {
    historyIndex = 0;
    currentValue = '';
    setSelection(() => editor.selections.map(s => editor.text(s)).join('\n'));
  })
  editor.element.addEventListener('focusin', () => {
    setSelection(() => editor.selections.map(s => editor.text(s)).join('\n'));
  }, true);
  editor.element.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && editor.selections[0].end.line === editor.lastLine) {
      moveHistory(-1);
    } else if (event.key === 'ArrowUp' && editor.selections[0].start.line === 0) {
      moveHistory(1);
    } else if (event.code === 'KeyN' && event.ctrlKey && !event.shiftKey) {
      moveHistory(-1);
    } else if (event.code === 'KeyP' && event.ctrlKey && !event.shiftKey) {
      moveHistory(1);
    } else if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey) {
      if (!editor.somethingSelected() && editor.selections.length === 1 && editor.selections[0].start.column === 0 && editor.selections[0].start.line === 0)
        event.stopImmediatePropagation();
      return;
    } else {
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);
  async function moveHistory(direction: -1 | 1) {
    const done = startAsyncWork('history');
    if (historyIndex === 0) {
      currentValue = editor.value;
      currentLanguage = languageEvent.current;
    }
    const prefix = editor.text({start: {column: 0, line: 0,}, end: editor.selections[0].start});
    const result = await shell.searchHistory(editor.value, prefix, historyIndex, direction);
    done();
    if (result === 'current' && editor.value !== currentValue) {
      editor.value = currentValue;
      languageEvent.dispatch(currentLanguage);
      historyIndex = 0;
      return;
    }
    if (result === 'end' || result === 'current') {
      beep();
      return;
    }
    historyIndex = result.historyIndex;
    editor.value = result.command;
    languageEvent.dispatch(result.language);
  }
  const observer = new ResizeObserver(() => {
    editor.layout();
  });
  observer.observe(editor.element);
  return {editor, autocomplete};
}

function beep() {
  host.sendMessage({
    method: 'beep',
  })
}