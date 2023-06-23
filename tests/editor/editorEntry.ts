import { Editor } from '../../slug/editor/js/editor';
import './editorEntry.css';
let editor = new Editor('', {
  lineNumbers: true,
  padBottom: true,
  wordWrap: true,
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
document.body.append(editor.element);;
editor.layout();
editor.focus();
window['editor'] = editor;
