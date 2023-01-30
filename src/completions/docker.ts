import { registerCompleter } from "../shellCompleter";

type AutocompleteDescription = {
  flags: {name: string, type?: string, description?: string}[],
  aliases: {short: string, long?: string}[],
  commands: (AutocompleteDescription & {name: string, description?: string})[],
};

registerCompleter('docker', async (shell, line, abortSignal) => {
  // probably not good at handling quotes just yet
  if (line.includes('\\') || line.includes('\'') || line.includes('\"'))
    return null;
  let description: AutocompleteDescription = {
    flags: [], aliases: [],
    commands: [{
      name: 'docker',
      ...await import('./docker.json'),
    }],
  };
  const parts = line.split(' ');
  let text = '';
  for (const part of parts) {
    if (text && !/\-\-?.+/.test(text)) {
      description = description.commands.find(x => x.name === text)
      if (!description)
        return null;
    }
    text = part;
  }
  const anchor = line.length - text.length;
  return {
    anchor,
    suggestions: [
      ...description.commands.map(command => ({text: command.name, description: async () => command.description})),
      ...description.flags.map(flag => ({
        text: '--' + flag.name,
        description: async () => flag.description,
        suffix: flag.type ? '=' + flag.type : undefined,
      })),
    ],
    exact: true,
  };
});
