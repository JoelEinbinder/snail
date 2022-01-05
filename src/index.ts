import { Editor } from '../editor';
import '../editor/css/editor.css';
const content = '// text editor!';

const editor = new Editor(content, {
  padBottom: true,
  lineNumbers: true,
  language: 'js',
  readOnly: false,
  // underlay: (lineNumber, text) => {
  //     return lineNumber % 2 ? [{text}] : [{text, background: '#eee'}]
  // }
});
window.addEventListener('resize', () => editor.layout(), false);
document.body.appendChild(editor.element);
editor.layout();
