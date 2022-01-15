import React from 'react';
import { usePromise } from './hooks';
import type { Shell, Entry } from './Shell';
import './shell.css';
import { makePromptEditor } from './PromptEditor';
import { render } from 'react-dom';

export class ShellView {
  private _element = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _promptElement: HTMLElement;
  private _lockingScroll = false;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._updateFullscreen();
    this._fullscreenElement.classList.add('fullscreen', 'entry');
    this._shell.fullscreenEntry.on(() => this._updateFullscreen());
    this._container.appendChild(this._element);
    this._element.style.overflowY = 'auto';
    this._element.style.position = 'absolute';
    this._element.style.inset = '0';
    this._element.style.padding = '4px';
    this._repopulate();
    this._shell.activeEntry.on(entry => {
      if (this._promptElement) {
        this._promptElement.remove();
        this._promptElement = null;
      }
      if (entry)
        this._addEntry(entry);
      else
        this._addPrompt();
    });
    this._shell.clearEvent.on(() => {
      this._repopulate();
    });
  }

  _repopulate() {
    this._element.textContent = '';
    for (const entry of this._shell.log)
      this._addEntry(entry);
    if (!this._shell.activeEntry.current)
      this._addPrompt();
  }

  _updateFullscreen() {
    const fullScreenEntry = this._shell.fullscreenEntry.current;
    if (fullScreenEntry) {
      this._element.style.display = 'none';
      this._container.appendChild(this._fullscreenElement);
      this._fullscreenElement.appendChild(fullScreenEntry.element);
      document.body.classList.add('fullscreen-entry');
      fullScreenEntry.focus();
    } else {
      this._fullscreenElement.remove();
      this._fullscreenElement.textContent = '';
      this._element.style.display = 'block';
      document.body.classList.remove('fullscreen-entry');
    }
  }

  _addEntry(entry: Entry) {
    const command = document.createElement('div');
    command.classList.add('command');
    render(<>
      <CommandPrefix shellOrEntry={entry} />
      <div className="user-text">{entry.command}</div>
    </>, command);
    const element = document.createElement('div');
    element.classList.add('entry');
    element.appendChild(command);
    element.appendChild(entry.element);
    entry.willResizeEvent.on(async () => {
      this._lockScroll();
    });
    this._lockScroll();
    this._element.appendChild(element);
    if (entry === this._shell.activeEntry.current)
      entry.focus();
  }

  async _lockScroll() {
    if (this._lockingScroll)
      return;
    const scrollBottom = this._element.scrollHeight - this._element.scrollTop - this._element.offsetHeight;
    
    this._lockingScroll = true;
    await Promise.resolve();
    this._lockingScroll = false;
    this._element.scrollTop = this._element.scrollHeight - this._element.offsetHeight - scrollBottom;
  }

  _addPrompt() {
    const element = document.createElement('div');
    element.classList.add('prompt');
    const editorWrapper = React.createRef<HTMLDivElement>();
    render(<>
      <CommandPrefix shellOrEntry={this._shell} />
      <div ref={editorWrapper} style={{position: 'relative', flex: 1, minHeight: '14px'}}
      onKeyDown={event => {
        if (event.key !== 'Enter')
          return;
        const command = editor.value;
        editor.value = '';
        this._shell.runCommand(command);
        event.stopPropagation();
        event.preventDefault();
      }} />
    </>, element);
    const editor = makePromptEditor(this._shell);
    editorWrapper.current.appendChild(editor.element);
    this._lockScroll();
    this._element.appendChild(element);
    editor.layout();
    editor.focus();
    this._promptElement = element;
  }
}

function CommandPrefix({shellOrEntry}: {shellOrEntry: Shell|Entry}) {
  const pwd = usePromise(shellOrEntry.cachedEvaluation('pwd'));
  const home = usePromise(shellOrEntry.cachedEvaluation('echo $HOME'));
  const revName = usePromise(shellOrEntry.cachedEvaluation('__git_ref_name'));
  const dirtyState = usePromise(shellOrEntry.cachedEvaluation('__is_git_dirty'));
  if (pwd === null || home === null)
    return <></>;
  if (revName === null || dirtyState === null)
    return <></>;
  const prettyName = pwd.startsWith(home) ? '~' + pwd.slice(home.length) : pwd;
  const GitStatus = revName ? <><Ansi color={75}>(<Ansi color={78}>{revName}</Ansi><Ansi color={214}>{dirtyState ? '*' : ''}</Ansi>)</Ansi></> : null;
  return  <div className="prefix"><Ansi color={32}>{prettyName}</Ansi>{GitStatus} <Ansi color={105}>»</Ansi> </div>;
}

function Ansi({children, color}) {
  return <span style={{color: 'var(--ansi-' + color + ')'}}>{children}</span>;
}
