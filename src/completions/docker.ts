import { registerCompleter } from "../shellCompleter";

type AutocompleteDescription = {
  flags: {name: string, type?: string, description?: string}[],
  aliases: {short: string, long?: string}[],
  commands: (AutocompleteDescription & {name: string, description?: string})[],
};

registerCompleter('docker', async (shell, line, abortSignal) => {
  // probably not good at handling quotes just yet
  // TODO: We should get the actual words the shjs tokenizer
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
  let type: string|undefined = undefined;
  for (const part of parts) {
    if (text) {
      if (type) {
        // TODO maybe handle lists here?
        type = null;
      }
      else if (/\-\-?.+/.test(text)) {
        const long = description.aliases.find(alias => '-' + alias.short === text)?.long;
        const flagText = long ? `--${long}` : text;
        const flag = description.flags.find(flag => '--' + flag.name === flagText);
        if (!flag)
          return null; // unknown flag used. we dont know if it eats the next arg so stop autocomplete
        type = flag.type;
      } else {
        type = undefined;
        description = description.commands.find(x => x.name === text)
        if (!description) // unknown command
          return null;
      }
    }
    text = part;
  }
  if (type)
    return null; // TODO maybe we can do some kind of hint from the type?
  const anchor = line.length - text.length;
  return {
    anchor,
    suggestions: [
      ...description.commands.map(command => ({text: command.name, description: async () => command.description})),
      ...description.flags.map(flag => ({
        text: '--' + flag.name,
        description: async () => flag.description,
        // suffix: flag.type ? '=' + flag.type : undefined,
      })),
    ],
    exact: true,
  };
});
