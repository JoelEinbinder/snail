import { Editor, TextRange } from "../slug/editor/js/editor";
import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import { LogItem } from "./LogView";
import { setSelection } from "./selection";
import type { Shell } from './Shell';

export class CommandBlock implements LogItem {
  public cachedEvaluationResult = new Map<string, Promise<string>>();
  willResizeEvent = new JoelEvent<void>(undefined);
  public wasCanceled = false;
  private _editor: Editor;
  private _exitCode = document.createElement('div');
  private _commandPrefix?: CommandPrefix;
  constructor(public command: string,
    private _size: JoelEvent<{rows: number, cols: number}>,
    private _connectionName: string,
    public env: {[key: string]: string},
    public cwd: string,
    globalVars?: Set<string>,
    private _sshAddress?: string) {
    this._editor = new Editor('', {
      inline: true,
      lineNumbers: false,
      language: 'shjs',
      padding: 0,
      colors: {
        cursorColor: '#f4f4f4',
        foreground: '#f4f4f4',
        selectionBackground: '#525252',
      },
      readOnly: true,
    });
    if (globalVars)
      this._editor.setModeOptions({globalVars});
    this._editor.on('selectionChanged', () => {
      setSelection(() => this._editor.selections.map(s => this._editor.text(s)).join('\n'));
    });
    this._editor.value = this.command;
    this._exitCode.classList.add('exit-code');
    const observer = new ResizeObserver(() => {
      this._editor.layout();
    });
    observer.observe(this._editor.element);

  }

  get sshAddress() {
    return this._sshAddress;
  }

  addSquiggly(range: TextRange, color: string) {
    this._editor.addSquiggly(range, color);
  }

  render(): Element {
    this.dispose();
    const command = document.createElement('div');
    command.classList.add('command');
    command.classList.toggle('canceled', this.wasCanceled);
    this._commandPrefix = new CommandPrefix(this, this._size);
    command.append(this._commandPrefix.element);
    this._commandPrefix.render();
    const editorWrapper = document.createElement('div');
    editorWrapper.style.position = 'relative';
    editorWrapper.style.flex = '1';
    editorWrapper.style.minHeight = '1.4em';
    command.append(editorWrapper);
    command.append(this._exitCode);
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
    this._commandPrefix?.dispose();
    delete this._commandPrefix;
  }

  setExitCode(code: number) {
    this._exitCode.textContent = String(code || '');
    if (this._editor.element.parentElement) {
      this._editor.layout();
    }
  }
  
  cachedEvaluation(code: string): Promise<string> {
    if (!this.cachedEvaluationResult)
      return Promise.resolve(null);
    if (!this.cachedEvaluationResult.has(code))
      return Promise.resolve(null);
    return this.cachedEvaluationResult.get(code);
  }

  async serializeForTest(): Promise<any> {
    return '> ' + this.command;
  }
}

export class CommandPrefix {
  element = document.createElement('div');
  private _cleanup?: () => void;
  constructor(private _shellOrCommand: Shell|CommandBlock, private _size: JoelEvent<{rows: number, cols: number}>, private _onClick?: (event: MouseEvent) => void) {
    this.element.classList.add('prefix');
  }
  async render() {
    this.dispose();
    const [revName, dirtyState] = await Promise.all([
      this._shellOrCommand.cachedEvaluation('__git_ref_name'),
      this._shellOrCommand.cachedEvaluation('__is_git_dirty'),
    ]);
    const sshAddress = this._shellOrCommand.sshAddress;
    const colors = {
      path: sshAddress? 112 : 32,
      arrow: sshAddress ? 106 : 105,
      paren: sshAddress ? 119 : 75,
      gitName: sshAddress? 119 : 78,
    };
    const prettyDirName = computePrettyDirName(this._shellOrCommand, this._shellOrCommand.cwd);
    const dir = Ansi(colors.path, prettyDirName);
    dir.classList.add('dir');
    const mediumDir = Ansi(colors.path, mediumDirname(prettyDirName));
    mediumDir.classList.add('dir');
    const tinyDir = Ansi(colors.path, tinyDirname(prettyDirName));
    tinyDir.classList.add('dir');
    if (this._onClick) {
      this.element.classList.add('clickable-dir-name');
      this.element.addEventListener('mousedown', this._onClick);
      this.element.addEventListener('contextmenu', this._onClick);
    }
    const GitStatus = revName ? Ansi(colors.paren,"(", Ansi(colors.gitName, revName), Ansi(214, dirtyState ? '*' : ''), ")") : '';
    const renderInner = () => {
      this.element.textContent = '';
      const badge = makeVenvBadge(this._shellOrCommand) || ' ';
      const arrow = Ansi(colors.arrow, '»');
      const layouts: (string | Node)[][] = [
        [dir, GitStatus, badge, arrow],
        [mediumDir, GitStatus, badge, arrow],
        [tinyDir, GitStatus, badge, arrow],
        [badge, arrow],
      ];
      let firstFittingLayout: (string | Node)[] = null;
      for (const layout of layouts) {
        firstFittingLayout = layout;
        if (this._size.current.cols - layout.reduce((a, b) => (b instanceof Node ? b.textContent.length : b.length) + a, 0) > 15)
          break;
      }
      this.element.append(...firstFittingLayout, ' ');
    };
    this._size.on(renderInner);
    renderInner();
  }
  dispose() {
    this._cleanup?.();
    delete this._cleanup;
  }
}

function makeVenvBadge(shellOrCommand: Shell|CommandBlock) {
  if (!shellOrCommand.env.VIRTUAL_ENV)
    return '';
  const span = document.createElement('span');
  span.classList.add('venv');
  span.title = computePrettyDirName(shellOrCommand, shellOrCommand.env.VIRTUAL_ENV);
  return span;
}

export function computePrettyDirName(shellOrCommand: Shell|CommandBlock, dir: string) {
  const home = shellOrCommand.env.HOME;
  return dir.startsWith(home) ? '~' + dir.slice(home.length) : dir;
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

function mediumDirname(dir: string) {
  const parts = dir.split('/');
  if (parts.length <= 2)
    return dir;
  return parts.slice(0, 2).join('/') + '/…/' + parts[parts.length - 1];
}

function tinyDirname(dir: string) {
  const parts = dir.split('/');
  if (parts.length <= 1)
    return dir;
  return parts[parts.length - 1];
}