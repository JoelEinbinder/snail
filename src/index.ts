import { Editor } from '../editor';
import '../editor/css/editor.css';
import '../editor/modes/shell';
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
