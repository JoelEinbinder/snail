import { Editor } from "../editor/js/editor";
import { JoelEvent } from "./JoelEvent";
import { LogItem } from "./LogView";
import type { Shell } from './Shell';

export class CommandBlock implements LogItem {
  public cachedEvaluationResult = new Map<string, Promise<string>>();
  willResizeEvent = new JoelEvent<void>(undefined);
  constructor(public command: string) {
  }
  render(): Element {
    const command = document.createElement('div');
    command.classList.add('command');
    command.append(CommandPrefix(this));
    const editorWrapper = document.createElement('div');
    editorWrapper.style.position = 'relative';
    editorWrapper.style.flex = '1';
    editorWrapper.style.minHeight = '14px';
    const editor = new Editor('', {
      inline: true,
      lineNumbers: false,
      language: 'js',
      padding: 0,
      colors: {
        cursorColor: '#f4f4f4',
        foreground: '#f4f4f4',
        selectionBackground: '#525252',
      },
      readOnly: true,
    });
    command.append(editorWrapper);
    editorWrapper.append(editor.element);
    editor.value = this.command;
    Promise.resolve().then(() => {
      this.willResizeEvent.dispatch();
      editor.layout();
    });
    return command;
  }
  focus(): void {
  }
  dispose(): void {
  }
  
  cachedEvaluation(code: string): Promise<string> {
    if (!this.cachedEvaluationResult)
      return Promise.resolve(null);
    if (!this.cachedEvaluationResult.has(code))
      return Promise.resolve(null);
    return this.cachedEvaluationResult.get(code);
  }
}

export function CommandPrefix(shellOrCommand: Shell|CommandBlock, onReady = () => {}) {
  const div = document.createElement('div');
  div.className = 'prefix';
  go();
  return div;
  async function go() {
    const [pwd, home, revName, dirtyState] = await Promise.all([
      shellOrCommand.cachedEvaluation('pwd'),
      shellOrCommand.cachedEvaluation('echo $HOME'),
      shellOrCommand.cachedEvaluation('__git_ref_name'),
      shellOrCommand.cachedEvaluation('__is_git_dirty'),
    ]);
    const prettyName = pwd.startsWith(home) ? '~' + pwd.slice(home.length) : pwd;
    const GitStatus = revName ? Ansi(75,"(", Ansi(78, revName), Ansi(214, dirtyState ? '*' : ''), ")") : '';
    div.append(Ansi(32, prettyName), GitStatus, ' ', Ansi(105, '»'), ' ');
    onReady();
  }
}

/**
 * @param {number} color
 * @param {...Node|string|null} children
 */
function Ansi(color, ...children) {
  const span = document.createElement('span');
  span.style.color = `var(--ansi-${color})`;
  span.append(...children.filter(x => x));
  return span;
}

