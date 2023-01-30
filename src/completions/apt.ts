import type { Suggestion } from "../autocomplete";
import type { Shell } from "../Shell";
import { registerCompleter } from "../shellCompleter";

registerCompleter('apt', async (shell, line, abortSignal) => {
  const anchor = 'apt '.length;
  const prefix = line.slice(anchor);
  if (prefix.includes(' ')) {
    const command = line.slice(4).split(' ')[0];
    const anchor = line.lastIndexOf(' ') + 1;
    if (command === 'install' || command === 'remove' || command === 'reinstall' || command === 'show') {
      const installedOnly = command === 'remove' || command === 'reinstall';
      const suggestions = await listPackages(shell, installedOnly);
      return {
        anchor,
        suggestions,
      };
    }
    return null;
  }
  
  return {
    anchor,
    suggestions: Object.entries(commands).map(([text, value]) => ({text, description: async () => value}))
  };
});

const commands = {
  'list': 'list packages based on package names',
  'search': 'search in package descriptions',
  'show': 'show package details',
  'install': 'install packages',
  'reinstall': 'reinstall packages',
  'remove': 'remove packages',
  'autoremove': 'Remove automatically all unused packages',
  'update': 'update list of available packages',
  'upgrade': 'upgrade the system by installing/upgrading packages',
  'full-upgrade': 'upgrade the system by removing/installing/upgrading packages',
  'edit-sources': 'edit the source information file',
};

async function listPackages(shell: Shell, installedOnly: boolean): Promise<Suggestion[]> {
  const command = installedOnly ? `apt list --installed | cat` : `apt list | cat`;
  const output = await shell.cachedEvaluation(command);
  const packages = output.split('\n').map(x => {
    const slash = x.indexOf('/');
    if (slash === -1)
      return '';
    return x.slice(0, slash);
  }).filter(Boolean);
  return packages.map(pkg => {
    return {
      description: async () => {
        const show = await shell.cachedEvaluation(`apt show ${pkg} | cat`);
        return show.slice(show.indexOf('Description: ') + 'Description: '.length).trim();
      },
      text: pkg,
    }
  });
}