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
    }
    return NoCompletions;
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