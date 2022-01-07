import { Editor } from '../editor/js/editor';
import '../editor/css/editor.css';
import '../editor/modes/shell';
import { Autocomplete } from './autocomplete';
const content = '// text editor!';

const editor = new Editor(content, {
  padBottom: false,
  lineNumbers: false,
  highlightWordOccurrences: false,
  language: 'sh',
  readOnly: false,
  // underlay: (lineNumber, text) => {
  //     return lineNumber % 2 ? [{text}] : [{text, background: '#eee'}]
  // }
});
window.addEventListener('resize', () => editor.layout(), false);
document.body.appendChild(editor.element);
editor.layout();
editor.focus();
editor.value = 'echo $FOO';
new Autocomplete(editor, simpleCompleter);

async function simpleCompleter(line: string, abortSignal: AbortSignal) {
  if (abortSignal.aborted)
      return;
  // slow things down just for testing
  await new Promise(x => {
      const timeout = setTimeout(x, 100);
      abortSignal.addEventListener('abort', () => {
          clearTimeout(timeout);
      });
  });
  const anchor = line.lastIndexOf(' ') + 1;
  const prefix = line.substring(anchor);

  const suggestions = makeSuggestions();

  return {
      anchor,
      prefix,
      suggestions,
  }
  function makeSuggestions() {
      if (anchor === 0)
          return [
              'echo',
              'ls',
              'pwd',
              'cd',
              'cat',
              'cp',
              'mv',
              'rm',
              'mkdir',
              'rmdir',
              'touch',
              'grep',
              'sed',
              'head',
              'tail',
          ];
      return ['foo', 'bar', 'baz'];
  }
}