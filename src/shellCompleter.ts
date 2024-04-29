import type { Completer, CompletionResult, Suggestion } from "./autocomplete";
import type { Shell } from "./Shell";

export type ShellCompleter = (shell: Shell, line: string, abortSignal: AbortSignal) => ReturnType<Completer>|null;

const registry = new Map<string, ShellCompleter>();
export function registerCompleter(prefix: string, completer: ShellCompleter) {
  registry.set(prefix, completer);
}

registry.set('sudo', async (shell, line, abortSignal) => {
  const completer = makeShellCompleter(shell);
  const result = await completer(line.substring('sudo '.length), abortSignal);
  if (!result)
    return result;
  return {
    anchor: result.anchor + 'sudo '.length,
    suggestions: result.suggestions,
  };
});

registry.set('cd', async (shell, line, abortSignal) => {
  return fileCompleter(shell, line, { directoriesOnly: true });
});

export function makeShellCompleter(shell: Shell): Completer {
  return async (line: string, abortSignal: AbortSignal) => {
    const {getAutocompletePrefix} = await import('../slug/shjs/transform');
    const prefix = getAutocompletePrefix(line, await shell.globalVars());
    let result: CompletionResult;
    if (prefix === null)
      return null;
    const prefixText = line.slice(prefix.start, prefix.end);
    if (prefixText === '' || (prefix.isSh && !prefixText.includes(' '))) {
      if (line.includes('/'))
        result = await fileCompleter(shell, line, {executablesOnly: true});
      else
        result = await commandCompleter(shell, line);
      return {
        anchor: result.anchor + line.length - prefixText.length,
        suggestions: result.suggestions,
        exact: result.exact,
      }
    }
    if (!prefix.isSh) {
      const suggestions = await shell.jsCompletions(prefixText);
      const anchor = prefix.end + 1;
      return {
        anchor,
        suggestions: suggestions,
        exact: true,
      }
    }
    const command = prefixText.split(' ')[0];
    result = await envCompleter(shell, line);
    if (!result && registry.has(command))
      result = await registry.get(command)(shell, prefixText, abortSignal);
    if (!result)
      result = await fileCompleter(shell, prefixText);
    return {
      anchor: prefix.start + result.anchor,
      suggestions: result.suggestions,
      exact: result.exact,
      preSorted: result.preSorted,
      preFiltered: result.preFiltered,
    };
  };
}

async function envCompleter(shell: Shell, line: string): Promise<CompletionResult> {
  const anchor = line.lastIndexOf('$');
  if (anchor === -1)
    return null;
  if (!/^\$\w*$/.test(line.slice(anchor)))
    return null;
  const envVars: {[key: string]: string} = JSON.parse(await shell.cachedEvaluation('__environment_variables'));
  return {
    anchor,
    suggestions: Object.entries(envVars).map(([key, value]) => ({
      text: '$' + key,
      description: async () => value,
    })),
    exact: true,
  }
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
    'this', 'class', 'await', 'async',
    'continue', 'break', 'return',
  ];
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
    exact: true,
  }
}

async function fileCompleter(shell: Shell, line: string, {executablesOnly, directoriesOnly}: {executablesOnly?: boolean, directoriesOnly?: boolean} = {}): ReturnType<Completer> {
  const pathStart = lastIndexIgnoringEscapes(line, ' ') + 1;
  const path = line.substring(pathStart);
  const anchor = path.lastIndexOf('/') + 1 + pathStart;
  const prefix = path.substring(0, anchor - pathStart);
  const directories = new Set(await parseCompletions(`__file_completions directory ${prefix}`));
  const files = directoriesOnly ? [...directories] : await parseCompletions(!executablesOnly ? `__file_completions all ${prefix}` : `__file_completions executable ${prefix}`);
  const suggestions: Suggestion[] = [];
  if (!path || path === '.')
    files.push('.');
  for (const file of files) {
    const escaped = file.replace(/\\/g, '\\\\').replace(/ /g, '\\ ');
      if (directories.has(file) && file !== '..')
        suggestions.push({ text: escaped, suffix: '/', activations: {
          '/': escaped + '/'
        } });
      else
        suggestions.push({ text: escaped });
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
