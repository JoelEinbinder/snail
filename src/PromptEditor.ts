import { Editor } from "../slug/editor/js/editor";
import { Autocomplete, Completer } from "./autocomplete";
import type { Shell } from "./Shell";
import '../slug/shjs/editorMode';
import '../slug/editor/modes/python';
import '../slug/editor/modes/shell';
import '../slug/editor/modes/javascript';
import { makeJSCompleter, makeShellCompleter } from "./shellCompleter";
import './completions/git';
import './completions/npx';
import './completions/npm';
import './completions/apt';
import './completions/docker';
import './completions/ai_model';
import { setSelection } from "./selection";
import { host } from "./host";
import { makeHistoryCompleter } from "./historyCompleter";
import { themeEditorColors } from "./theme";
import { startAyncWork } from "./async";
import { makePythonCompleter } from "./pythonCompleter";

export function makePromptAutocomplete(editor: Editor, shell: Shell) {
  return new Autocomplete(editor, {
    shjs: makeShellCompleter(shell),
    py: makePythonCompleter(shell),
    js: makeJSCompleter(shell),
  }, ' /.', {
    'KeyR': makeHistoryCompleter(shell),
  });
}

export function makePromptEditor(shell: Shell, language: string) {
  const editor = new Editor('', {
    inline: true,
    lineNumbers: false,
    language,
    padding: 0,
    wordWrap: true,
    colors: themeEditorColors(),
  });
  shell.globalVars().then(globalVars => {
    editor.setModeOptions({globalVars});
  })

  let historyIndex = 0;
  let currentValue = '';
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
    const done = startAyncWork('history');
    if (historyIndex === 0)
      currentValue = editor.value;
    const prefix = editor.text({start: {column: 0, line: 0,}, end: editor.selections[0].start});
    const result = await shell.searchHistory(editor.value, prefix, historyIndex, direction);
    done();
    if (result === 'current' && editor.value !== currentValue) {
      editor.value = currentValue;
      historyIndex = 0;
      return;
    }
    if (result === 'end' || result === 'current') {
      beep();
      return;
    }
    historyIndex = result.historyIndex;
    editor.value = result.command;
  }
  const observer = new ResizeObserver(() => {
    editor.layout();
  });
  observer.observe(editor.element);
  return editor;
}

function beep() {
  host.sendMessage({
    method: 'beep',
  })
}