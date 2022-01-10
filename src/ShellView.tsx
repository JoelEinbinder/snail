import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useEvent, usePromise } from './hooks';
import type { Shell, Entry } from './Shell';
import './shell.css';
import { Editor } from '../editor/'
import '../editor/modes/shell'
import { Autocomplete } from './autocomplete';

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
  const editorWrapper = useRef<HTMLDivElement>(null);
  const activeEntry = useEvent(shell.activeEntry);
  const editorRef = useRef<Editor>(null);
  useLayoutEffect(() => {
    if (!editorWrapper.current)
      return;
    if (!editorRef.current) {
      editorRef.current = new Editor('', {
        inline: true,
        lineNumbers: false,
        language: 'sh',
        padding: 0,
        colors: {
          cursorColor: '#fff',
          foreground: '#fff',
          selectionBackground: '#fff',
        }
      });
      new Autocomplete(editorRef.current, async (line, abortSignal) => {
        if (line.includes(' '))
          return {anchor: 0, prefix: '', suggestions: []};
          const suggestions = (await shell.cachedEvaluation('compgen -c')).split('\n').filter(x => /^[A-Za-z]/.test(x));

        return {
          anchor: 0,
          prefix: line,
          suggestions: [...new Set(suggestions)]
        }
      });
    }
    editorWrapper.current.appendChild(editorRef.current.element);
    editorRef.current.layout();
    if (!activeEntry) {
      editorRef.current.focus();
    }
    return () => {
      editorRef.current.element.remove();
      editorRef.current = null;
    }
  }, [editorWrapper, editorRef, activeEntry, shell])

  return <div className='prompt'>
    <CommandPrefix shellOrEntry={shell} />
    <div ref={editorWrapper} style={{position: 'relative', flex: 1}} onKeyDown={event => {
    if (event.key !== 'Enter')
      return;
    const command = editorRef.current.value;
    editorRef.current.value = '';
    shell.runCommand(command);
    event.stopPropagation();
    event.preventDefault();
    }} />
  </div>;
}

function CommandPrefix({shellOrEntry}: {shellOrEntry: Shell|Entry}) {
  const pwd = usePromise(shellOrEntry.cachedEvaluation('pwd'));
  const home = usePromise(shellOrEntry.cachedEvaluation('echo $HOME'));
  const revName = usePromise(shellOrEntry.cachedEvaluation('__git_ref_name'))
  const dirtyState = usePromise(shellOrEntry.cachedEvaluation('__is_git_dirty'))
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
