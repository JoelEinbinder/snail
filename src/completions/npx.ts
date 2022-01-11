import type { Shell } from "../Shell";
import { registerCompleter } from "../shellCompleter";

registerCompleter('npx', async (shell, line, abortSignal) => {
  const anchor = 'npx '.length;
  const prefix = line.slice(anchor);
  if (prefix.includes(' '))
    return;
  const suggestions = (await shell.cachedEvaluation('__npx_completions')).split('\n').map(x => x.trim());
  return {
    anchor,
    suggestions
  };
});
