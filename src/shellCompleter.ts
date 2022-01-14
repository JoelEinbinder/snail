import type { Completer, Suggestion } from "./autocomplete";
import type { Shell } from "./Shell";

export type ShellCompleter = (shell: Shell, line: string, abortSignal: AbortSignal) => ReturnType<Completer>|null;

const registry = new Map<string, ShellCompleter>();
export function registerCompleter(prefix: string, completer: ShellCompleter) {
  registry.set(prefix, completer);
}

export function makeShellCompleter(shell: Shell): Completer {
  return async (line: string, abortSignal: AbortSignal) => {
    if (!line.includes(' ')) {
      if (line.includes('/'))
        return fileCompleter(shell, line, true);
      return commandCompleter(shell, line);
    }
    const command = line.split(' ')[0];
    if (registry.has(command)) {
      const result = await registry.get(command)(shell, line, abortSignal);
      if (result)
        return result;
    }
    return fileCompleter(shell, line, false);
  };
}

async function commandCompleter(shell: Shell, line: string) {
  const suggestions = (await shell.cachedEvaluation('compgen -c')).split('\n').map(t => t.trim()).filter(x => /^[A-Za-z]/.test(x));

  return {
    anchor: 0,
    suggestions: [...new Set(suggestions)].map(text => ({text})),
  }
}

async function fileCompleter(shell: Shell, line: string, executablesOnly: boolean) {
  const pathStart = lastIndexIgnoringEscapes(line, ' ') + 1;
  const path = line.substring(pathStart);
  const anchor = path.lastIndexOf('/') + 1 + pathStart;
  const files = await parseCompletions(!executablesOnly ? `compgen -f ${path}` : `eval 'for f in \`compgen -f ${path}\`; do [ -x $f ] && echo $f; done'`);
  const directories = new Set(await parseCompletions(`compgen -d ${path}`));
  const suggestions: Suggestion[] = [];
  for (const file of files) {
      if (directories.has(file) && file !== '.' && file !== '..')
        suggestions.push({ text: file, suffix: '/', activations: {
          '/': file + '/'
        } });
      else
        suggestions.push({ text: file });
  }
  return {
    anchor,
    suggestions,
  }

  async function parseCompletions(command: string) {
    const raw = await shell.cachedEvaluation(command);
    return raw.split('\r\n').map(complete => {
      // we only want the last path segment
      const lastSlash = lastIndexIgnoringEscapes(complete, '/');
      return escapeString(complete.substring(lastSlash + 1));
    }).filter(x => x);
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
