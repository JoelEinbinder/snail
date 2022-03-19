import { Editor, TextRange } from "../editor/js/editor";
import { JoelEvent } from "./JoelEvent";
import { LogItem } from "./LogView";
import type { Shell } from './Shell';

export class CommandBlock implements LogItem {
  public cachedEvaluationResult = new Map<string, Promise<string>>();
  willResizeEvent = new JoelEvent<void>(undefined);
  private _editor: Editor;
  constructor(public command: string, private _connectionName: string, private _sshAddress?: string) {
    this._editor = new Editor('', {
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
    this._editor.value = this.command;

  }

  get sshAddress() {
    return this._sshAddress;
  }

  addSquiggly(range: TextRange, color: string) {
    this._editor.addSquiggly(range, color);
  }

  render(): Element {
    const command = document.createElement('div');
    command.classList.add('command');
    command.append(CommandPrefix(this));
    const editorWrapper = document.createElement('div');
    editorWrapper.style.position = 'relative';
    editorWrapper.style.flex = '1';
    editorWrapper.style.minHeight = '14px';
    command.append(editorWrapper);
    editorWrapper.append(this._editor.element);
    const connectionNameElement = document.createElement('div');
    connectionNameElement.classList.add('connection-name');
    connectionNameElement.textContent = this._connectionName;
    command.append(connectionNameElement);
    Promise.resolve().then(() => {
      this.willResizeEvent.dispatch();
      this._editor.layout();
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
    const [prettyName, revName, dirtyState] = await Promise.all([
      computePrettyDirName(shellOrCommand),
      shellOrCommand.cachedEvaluation('__git_ref_name'),
      shellOrCommand.cachedEvaluation('__is_git_dirty'),
    ]);
    const sshAddress = shellOrCommand.sshAddress;
    const colors = {
      path: sshAddress? 112 : 32,
      arrow: sshAddress ? 106 : 105,
      paren: sshAddress ? 119 : 75,
      gitName: sshAddress? 119 : 78,
    }
    const GitStatus = revName ? Ansi(colors.paren,"(", Ansi(colors.gitName, revName), Ansi(214, dirtyState ? '*' : ''), ")") : '';
    div.append(Ansi(colors.path, prettyName), GitStatus, ' ', Ansi(colors.arrow, '»'), ' ');
    onReady();
  }
}

export async function computePrettyDirName(shellOrCommand: Shell|CommandBlock) {
  const [pwd, home] = await Promise.all([
    shellOrCommand.cachedEvaluation('pwd'),
    shellOrCommand.cachedEvaluation('echo $HOME'),
  ]);
  return pwd.startsWith(home) ? '~' + pwd.slice(home.length) : pwd;
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

