import { Editor } from "../editor/js/editor";
import { Autocomplete } from "./autocomplete";
import type { Shell } from "./Shell";
import '../editor/modes/shell'
import { makeShellCompleter } from "./shellCompleter";
import './completions/git';
import './completions/npx';
import { historyPromise } from "./history";

export function makePromptEditor(shell: Shell) {
  const editor = new Editor('', {
    inline: true,
    lineNumbers: false,
    language: 'sh',
    padding: 0,
    colors: {
      cursorColor: '#fff',
      foreground: '#fff',
      selectionBackground: '#fff',
    }
  });
  new Autocomplete(editor, makeShellCompleter(shell), ' /');
  let historyIndex = 0;
  let currentValue = '';
  editor.on('selectionChanged', () => {
    historyIndex = 0;
    currentValue = '';
  })
  editor.element.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      moveHistory(-1);
    } else if (event.key === 'ArrowUp') {
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
    historyIndex = await searchHistory(editor.value, prefix, historyIndex, direction);
    if (historyIndex < 0) {
      historyIndex = 0;
      beep();
      return;
    }
    const history = await historyPromise;
    if (historyIndex >= history.length) {
      historyIndex = history.length - 1;
      beep();
      return;
    }
    if (historyIndex === 0) {
      editor.value = currentValue;
    } else {
      editor.value = history[history.length - historyIndex].command;
    }
  }
  return editor;
}

async function searchHistory(current: string, prefix: string, start: number, direction: number) {
  const history = await historyPromise;
  let index = start + direction;
  for (; index >= 0 && index < history.length; index += direction) {
    if (index === 0)
      return index;
    const {command} = history[history.length - index];
    if (command.startsWith(prefix) && command !== current)
      return index;
  }
  return index;
}

function beep() {
  window.electronAPI.sendMessage({
    method: 'beep',
  })
}