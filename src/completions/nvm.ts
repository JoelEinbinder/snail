import type { Suggestion } from "../autocomplete";
import type { Shell } from "../Shell";
import { registerCompleter } from "../shellCompleter";

registerCompleter('nvm', async (shell, line, abortSignal) => {
  const anchor = 4;
  const prefix = line.slice(anchor);
  if (prefix.includes(' ')) {
    const command = line.slice(4).split(' ')[0];
    const anchor = line.lastIndexOf(' ') + 1;
    const seenArgs = line.slice(0, anchor).split(' ').filter(x => x && !x.startsWith('-')).length;
    if (seenArgs === 2) {
      if (command === 'use' || command === 'run' || command === 'exec' || command === 'ls' || command == 'list' || command === 'uninstall') {
        return {
          anchor,
          preSorted: true,
          suggestions: await installedNodes(shell),
        };
      }
      if (command === 'alias' || command === 'unalias') {
        return {
          anchor,
          preSorted: true,
          suggestions: await nvmAliases(shell),
        };
      }
      if (command === 'cache') {
        return {
          anchor,
          preSorted: true,
          suggestions: [{ text: 'clear' }, { text: 'dir' }],
        };
      }
    }
    return null;
  }
  
  return {
    anchor,
    preSorted: true,
    suggestions: Object.entries(commands).map(([text, value]) => ({text: text + ' ', description: async () => value}))
  };
});

const commands = {
  'help': 'Show help message.',
  'install': 'Download and install a <version>. Uses .nvmrc if available and version is omitted.',
  'uninstall': 'Uninstall a version',
  'use': 'Modify PATH to use <version>. Uses .nvmrc if available and version is omitted.',
  'exec': 'Run <command> on <version>. Uses .nvmrc if available and version is omitted.',
  'run': 'Run `node` on <version> with <args> as arguments. Uses .nvmrc if available and version is omitted.',
  'current': 'Display currently activated version of Node',
  'list': 'List installed versions, matching a given <version> if provided',
  'list-remote': 'List remote versions available for install, matching a given <version> if provided',
  'version': 'Resolve the given description to a single local version',
  'version-remote': 'Resolve the given description to a single remote version',
  'deactivate': 'Undo effects of `nvm` on current shell',
  'alias': 'Set or show aliases',
  'unalias': 'Deletes the alias named <name>',
  'install-latest-npm': 'Attempt to upgrade to the latest working `npm` on the current node version',
  'reinstall-packages': 'Reinstall global `npm` packages contained in <version> to current version',
  'unload': 'Unload `nvm` from shell',
  'which': 'Display path to installed node version. Uses .nvmrc if available and version is omitted.',
  'cache': 'Display or empty cache directory',
  'set-colors': 'Set five text colors using format "yMeBg". Available when supported.',
};

async function installedNodes(shell: Shell): Promise<Suggestion[]> {
  return [
    ...(await shell.cachedEvaluation('nvm_ls')).split('\n').map(x => x.trim()).map(text => ({text})),
    ...(await nvmAliases(shell)),
  ]
}

async function nvmAliases(shell: Shell): Promise<Suggestion[]> {
  const aliases = (await shell.cachedEvaluation('find $NVM_DIR/alias -type f | sed "s:$NVM_DIR/alias/::"')).split('\n').map(x => x.trim());
  aliases.push('node', 'stable', 'unstable', 'iojs');
  return aliases.map(x => ({text: x}));
}
