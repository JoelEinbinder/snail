import { Editor } from "../editor/js/editor";
import { Autocomplete } from "./autocomplete";
import type { Shell } from "./Shell";
import '../shjs/editorMode';
import { makeShellCompleter } from "./shellCompleter";
import './completions/git';
import './completions/npx';
import './completions/npm';
import './completions/apt';
import { searchHistory } from "./history";
import { setSelection } from "./selection";
import { host } from "./host";

export function makePromptEditor(shell: Shell) {
  const editor = new Editor('', {
    inline: true,
    lineNumbers: false,
    language: 'shjs',
    padding: 0,
    colors: {
      cursorColor: '#f4f4f4',
      foreground: '#f4f4f4',
      selectionBackground: '#525252',
    }
  });
  shell.globalVars().then(globalVars => {
    editor.setModeOptions({globalVars});
  })
  const autocomplete = new Autocomplete(editor, makeShellCompleter(shell), ' /.');
  let historyIndex = 0;
  let currentValue = '';
  editor.on('selectionChanged', () => {
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
    } else if (event.code === 'KeyN' && event.ctrlKey) {
      moveHistory(-1);
    } else if (event.code === 'KeyP' && event.ctrlKey) {
      moveHistory(1);
    } else {
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);
  async function moveHistory(direction: -1 | 1) {
    if (historyIndex === 0)
      currentValue = editor.value;
    const prefix = editor.text({start: {column: 0, line: 0,}, end: editor.selections[0].start});
    const result = await searchHistory(editor.value, prefix, historyIndex, direction);
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
  return {editor, autocomplete};
}

function beep() {
  host.sendMessage({
    method: 'beep',
  })
}