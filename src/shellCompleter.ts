import type { Completer, Suggestion } from "./autocomplete";
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

export function makeShellCompleter(shell: Shell): Completer {
  return async (line: string, abortSignal: AbortSignal) => {
    const {getAutocompletePrefix} = await import('../shjs/transform');
    const prefix = getAutocompletePrefix(line, await shell.globalVars());
    let result: {anchor: number, suggestions: Suggestion[]};
    if (prefix === null)
      return null;
    if (prefix === '' || (typeof prefix !== 'string' && !prefix.shPrefix.includes(' '))) {
      if (line.includes('/'))
        result = await fileCompleter(shell, line, true);
      else
        result = await commandCompleter(shell, line);
      const offset = typeof prefix === 'string' ? prefix.length : prefix.shPrefix.length;
      return {
        anchor: result.anchor + line.length - offset,
        suggestions: result.suggestions,
      }
    }
    if (typeof prefix === 'string') {
      const suggestions = await shell.jsCompletions(prefix);
      const anchor = line.lastIndexOf(prefix) + prefix.length + 1;
      return {
        anchor,
        suggestions: suggestions,
      }
    }
    const offset = line.lastIndexOf(prefix.shPrefix);
    const command = prefix.shPrefix.split(' ')[0];
    result = await envCompleter(shell, line);
    if (!result && registry.has(command))
      result = await registry.get(command)(shell, prefix.shPrefix, abortSignal);
    if (!result)
      result = await fileCompleter(shell, prefix.shPrefix, false);
    return {
      anchor: offset + result.anchor,
      suggestions: result.suggestions,
    };
  };
}

async function envCompleter(shell: Shell, line: string): Promise<{anchor: number, suggestions: Suggestion[]}> {
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
    'this', 'class', 'await', 'async'];
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
  if (!path || path === '.')
    files.push('.');
  for (const file of files) {
      if (directories.has(file) && file !== '..')
        suggestions.push({ text: file, suffix: '/', activations: {
          '/': file + '/'
        } });
      else
        suggestions.push({ text: file.replace(/\\/g, '\\\\').replace(/ /g, '\\ ') });
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
