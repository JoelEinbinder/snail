import React, { useLayoutEffect, useRef } from 'react';
import { useEvent } from './hooks';
import type { Shell, Entry } from './Shell';

export function ShellView({shell}: {shell: Shell}) {
  const fullScreenEntry = useEvent(shell.fullscreenEntry);
  if (fullScreenEntry)
    return <EntryView entry={fullScreenEntry}/>;
  return <>
    <Log shell={shell} />
    <Prompt onCommmand={command => {
      shell.runCommand(command);
    }}/>
  </>
}

function Log({shell}: {shell: Shell}) {
  useEvent(shell.updated);
  return <div>{shell.log.map((e, i) => <EntryView key={i} entry={e} />)}</div>;
}

function EntryView({entry}: {entry: Entry}) {
  const ref = useRef<HTMLDivElement>(null);
  const isFullscreen = useEvent(entry.fullscreenEvent);
  useLayoutEffect(() => {
    if (!ref.current || !ref.current.parentNode)
      return;
    ref.current.replaceWith(entry.element);
  });
  if (isFullscreen)
    return <div><div ref={ref} /></div>;
  return <div>
    <div>{entry.command}</div>
    <div ref={ref}></div>
  </div>
}

function Prompt({onCommmand}: {onCommmand: (command: string) => void}) {
  return <input onKeyDown={event => {
    if (event.key !== 'Enter')
      return;
    const self = event.target as HTMLInputElement;
    const command = self.value;
    self.value = '';
    onCommmand(command);
  }} />;
}
