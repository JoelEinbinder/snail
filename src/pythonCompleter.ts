import type { Completer } from "./autocomplete";
import type { Shell } from "./Shell";

export function makePythonCompleter(shell: Shell): Completer {
  return async(line: string, abortSignal: AbortSignal) => {
    const {anchor, suggestions} = await shell.pythonCompletions(line);
    return {
      anchor,
      suggestions: suggestions.map(text => ({ text })),
      exact: true,
    }
  };
}