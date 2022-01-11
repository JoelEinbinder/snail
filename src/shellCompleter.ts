import type { Completer } from "./autocomplete";
import type { Shell } from "./Shell";

export type ShellCompleter = (shell: Shell, line: string, abortSignal: AbortSignal) => ReturnType<Completer>|null;

const registry = new Map<string, ShellCompleter>();
export function registerCompleter(prefix: string, completer: ShellCompleter) {
  registry.set(prefix, completer);
}

const NoCompletions = {
  anchor: 0,
  prefix: '',
  suggestions: [],
}

export function makeShellCompleter(shell: Shell): Completer {
  return async (line: string, abortSignal: AbortSignal) => {
    if (!line.includes(' '))
      return commandCompleter(shell, line);
    const command = line.split(' ')[0];
    if (registry.has(command)) {
      const result = await registry.get(command)(shell, line, abortSignal);
      if (result)
        return result;
      else
        return NoCompletions;
    }
    return fileCompleter(shell, line);
  };
}

async function commandCompleter(shell: Shell, line: string) {
  const suggestions = (await shell.cachedEvaluation('compgen -c')).split('\n').map(t => t.trim()).filter(x => /^[A-Za-z]/.test(x));

  return {
    anchor: 0,
    prefix: line,
    suggestions: [...new Set(suggestions)]
  }
}

async function fileCompleter(shell: Shell, line: string) {
  const pathStart = lastIndexIgnoringEscapes(line, ' ') + 1;
  const path = line.substring(pathStart);
  const anchor = path.lastIndexOf('/') + 1 + pathStart;
  const prefix = path.substring(anchor);
  const suggestions = (await shell.cachedEvaluation(`compgen -f ${path}`)).split('\n').map(complete => {
    // we only want the last path segment
    const lastSlash = lastIndexIgnoringEscapes(complete, '/');
    return escapeString(complete.substring(lastSlash + 1));
  }).filter(x => x);
  return {
    anchor,
    prefix,
    suggestions,
  }
}

function lastIndexIgnoringEscapes(str: string, char: string) {
  let lastIndex = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char)
      lastIndex = i;
    if (str[i] === '\\')
      i++;
  }
  return lastIndex;
}

function escapeString(str: string) {
  return str.replace(/([\\"'$` ])/g, '\\$1');
}
