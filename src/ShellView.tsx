import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useEvent } from './hooks';
import type { Shell, Entry } from './Shell';

export function ShellView({shell}: {shell: Shell}) {
  const fullScreenEntry = useEvent(shell.fullscreenEntry);
  const activeEntry = useEvent(shell.activeEntry);
  if (fullScreenEntry)
    return <EntryView entry={fullScreenEntry}/>;
  return <>
    <Log shell={shell} />
    <Prompt shell={shell}/>
  </>
}

function Log({shell}: {shell: Shell}) {
  useEvent(shell.updated);
  return <div>{shell.log.map((e, i) => <EntryView key={i} entry={e} />)}</div>;
}

function EntryView({entry}: {entry: Entry}) {
  const ref = useRef<HTMLDivElement>(null);
  const isFullscreen = useEvent(entry.fullscreenEvent);
  const isActive = useEvent(entry.activeEvent);
  useLayoutEffect(() => {
    if (!ref.current || !ref.current.parentNode)
      return;
    ref.current.replaceWith(entry.element);
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

  if (isFullscreen)
    return <div><div ref={ref} /></div>;
  return <div>
    <div>$ {entry.command}</div>
    <div ref={ref}></div>
  </div>
}

function Prompt({shell}: {shell: Shell}) {
  const input = useRef<HTMLInputElement>(null);
  const activeEntry = useEvent(shell.activeEntry);
  useEffect(() => {
    if (input.current && !activeEntry)
      input.current.focus();
  }, [activeEntry, input]);
  return <input ref={input} onKeyDown={event => {
    if (event.key !== 'Enter')
      return;
    const self = event.target as HTMLInputElement;
    const command = self.value;
    self.value = '';
    shell.runCommand(command);
  }} />;
}
