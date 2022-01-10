import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useEvent, usePromise } from './hooks';
import type { Shell, Entry } from './Shell';
import './shell.css';

export function ShellView({shell}: {shell: Shell}) {
  const fullScreenEntry = useEvent(shell.fullscreenEntry);
  const activeEntry = useEvent(shell.activeEntry);
  if (fullScreenEntry)
    return <EntryView entry={fullScreenEntry}/>;
  return <>
      <Log shell={shell} />
      {activeEntry ? null : <Prompt shell={shell}/>}
  </>
}

function Log({shell}: {shell: Shell}) {
  useEvent(shell.updated);
  return <div>{shell.log.map(e => <EntryView key={e.id} entry={e} />)}</div>;
}

function EntryView({entry}: {entry: Entry}) {
  const ref = useRef<HTMLDivElement>(null);
  const isFullscreen = useEvent(entry.fullscreenEvent);
  const isActive = useEvent(entry.activeEvent);
  useLayoutEffect(() => {
    if (!ref.current || !ref.current.parentNode)
      return;
    ref.current.appendChild(entry.element);
    return () => {
      entry.element.remove();
    }
  });
  useLayoutEffect(() => {
    if (!isFullscreen)
      return;
    document.body.classList.add('fullscreen-entry');
    return () => document.body.classList.remove('fullscreen-entry');
  }, [isFullscreen]);
  useEffect(() => {
    if (isActive)
      entry.focus();
  }, [entry, isActive]);
  if (isFullscreen && isActive)
    return <div className='entry active fullscreen'><div ref={ref} /></div>;
  return <div className={'entry' + (isActive ? ' active' : '')}>
    <div className='command'>
      <CommandPrefix shellOrEntry={entry} />
      <div className="user-text">{entry.command}</div>
    </div>
    <div ref={ref} className="placeholder"></div>
  </div>
}

function Prompt({shell}: {shell: Shell}) {
  const input = useRef<HTMLInputElement>(null);
  const activeEntry = useEvent(shell.activeEntry);
  useLayoutEffect(() => {
    if (input.current && !activeEntry)
      input.current.focus();
  }, [activeEntry, input]);
  return <div className='prompt'>
    <CommandPrefix shellOrEntry={shell} />
    <input ref={input} onKeyDown={event => {
    if (event.key !== 'Enter')
      return;
    const self = event.target as HTMLInputElement;
    const command = self.value;
    self.value = '';
    shell.runCommand(command);
    event.stopPropagation();
    event.preventDefault();
    }} />
  </div>;
}

function CommandPrefix({shellOrEntry}: {shellOrEntry: Shell|Entry}) {
  const pwd = usePromise(shellOrEntry.cachedEvaluation('pwd'));
  const home = usePromise(shellOrEntry.cachedEvaluation('echo $HOME'));
  if (pwd === null || home === null)
    return <></>;
  const prettyName = pwd.startsWith(home) ? '~' + pwd.slice(home.length) : pwd;
  return  <div className="prefix"><span style={{color: 'var(--ansi-32)'}}>{prettyName}</span> <span style={{color: 'var(--ansi-105)'}}>»</span> </div>;
}
