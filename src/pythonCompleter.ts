import type { Completer } from "./autocomplete";
import type { Shell } from "./Shell";

export function makePythonCompleter(shell: Shell): Completer {
  return async(line: string, abortSignal: AbortSignal) => {
    const {anchor, suggestions} = await shell.pythonCompletions(line);
    return {
      anchor,
      suggestions: suggestions.map(({text, description}) => ({
        text,
        description: description ? (async () => description.trim()) : undefined
      })),
      exact: true,
      cssTag: 'python'
    }
  };
}