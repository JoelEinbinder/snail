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
  const [commands, globalVars] = await Promise.all([
    shell.cachedEvaluation('__command_completions'),
    shell.globalVars(),
  ]);
  const seenSuggestions = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const text of commands.split('\n').map(t => t.trim()).filter(x => /^[A-Za-z]/.test(x))) {
    addItem({text, description: async () => {
      const result = await shell.cachedEvaluation('__command_description ' + escapeString(text));
      return result.trim();
    }});
  }
  for (const text of globalVars)
    addItem({text});
  const keywords = [
    'if', 'while', 'with',
    'do', 'try', 'new',
    'delete', 'void', 'throw',
    'debugger', 'var', 'const',
    'let', 'function', 'for',
    'switch', 'typeof', 'instanceof',
    'true', 'false', 'null',
    'undefined', 'NaN', 'Infinity',
    'this', 'class', 'await'];
  for (const text of keywords)
    addItem({text});
  function addItem(item: Suggestion) {
    if (seenSuggestions.has(item.text))
      return;
    seenSuggestions.add(item.text);
    suggestions.push(item);
  }
  return {
    anchor: 0,
    suggestions,
  }
}

async function fileCompleter(shell: Shell, line: string, executablesOnly: boolean) {
  const pathStart = lastIndexIgnoringEscapes(line, ' ') + 1;
  const path = line.substring(pathStart);
  const anchor = path.lastIndexOf('/') + 1 + pathStart;
  const prefix = path.substring(0, anchor - pathStart);
  const files = await parseCompletions(!executablesOnly ? `__file_completions all ${prefix}` : `__file_completions executable ${prefix}`);
  const directories = new Set(await parseCompletions(`__file_completions directory ${prefix}`));
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
    return raw.split('\n').filter(x => x);
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
