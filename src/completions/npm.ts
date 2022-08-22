import { registerCompleter } from "../shellCompleter";

registerCompleter('npm', async (shell, line, abortSignal) => {
  const words = line.split(' ');
  const before = words.slice(0, words.length - 1).join(' ');
  if (/[^a-zA-Z\d\s\-_]/.test(before))
    return;
  const anchor = before.length + 1;
  const prefix = line.slice(anchor);
  const dashes = /^(\-*)/.exec(prefix)[1];
  const command = `COMP_CWORD=${words.length - 1} COMP_LINE='${before} ' COMP_POINT=${before.length} npm completion -- ${[...words.slice(0, words.length - 1), dashes].map(x => `'${x}'`).join(' ')}`;
  const suggestions = (await shell.cachedEvaluation(command)).split('\n').map(x => x.trim()).filter(x => x).map(text => ({text}));
  if (!suggestions.length)
    return;
  return {
    anchor,
    suggestions,
    exact: true,
  };
});
