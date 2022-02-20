import { JoelEvent } from "./JoelEvent";
import { LogItem } from "./LogView";
import { render } from 'react-dom';
import { usePromise } from './hooks';
import type { Shell } from './Shell';
import React from 'react';

export class CommandBlock implements LogItem {
  public cachedEvaluationResult = new Map<string, Promise<string>>();
  willResizeEvent = new JoelEvent<void>(undefined);
  constructor(public command: string) {
  }
  render(): Element {
    const command = document.createElement('div');
    command.classList.add('command');
    console.log(this.cachedEvaluationResult);
    render(<>
      <CommandPrefix shellOrCommand={this} />
      <div className="user-text">{this.command}</div>
    </>, command);
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

export function CommandPrefix({shellOrCommand}: {shellOrCommand: Shell|CommandBlock}) {
  const pwd = usePromise(shellOrCommand.cachedEvaluation('pwd'));
  const home = usePromise(shellOrCommand.cachedEvaluation('echo $HOME'));
  const revName = usePromise(shellOrCommand.cachedEvaluation('__git_ref_name'));
  const dirtyState = usePromise(shellOrCommand.cachedEvaluation('__is_git_dirty'));
  if (pwd === null || home === null)
    return <></>;
  if (revName === null || dirtyState === null)
    return <></>;
  const prettyName = pwd.startsWith(home) ? '~' + pwd.slice(home.length) : pwd;
  const GitStatus = revName ? <><Ansi color={75}>(<Ansi color={78}>{revName}</Ansi><Ansi color={214}>{dirtyState ? '*' : ''}</Ansi>)</Ansi></> : null;
  return <div className="prefix"><Ansi color={32}>{prettyName}</Ansi>{GitStatus} <Ansi color={105}>»</Ansi> </div>;
}

function Ansi({children, color}) {
  return <span style={{color: 'var(--ansi-' + color + ')'}}>{children}</span>;
}
