// Set up to do docker right now
const {spawnSync} = require('child_process');
const command = process.argv[2];

console.log(JSON.stringify(parseHelp(command)));

// MIT License
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// Footer

function parseHelp(command, ...args) {
  const output = spawnSync(command, [...args, '--help'], {stdio: ['inherit', 'pipe', 'inherit']});
  const help = output.stdout.toString();
  const aliases = [];
  const flags = [];

	const regex = /^\s*[^$]\s*(?:-([a-z-]),[ \t]+)?--([a-z-]+) +(.*)$/gim;
  let result;
  while (result = regex.exec(help)) {
    const subMatches = result.slice(1);
		const [shortFlag, longFlag, description] = subMatches;

		if (shortFlag)
			aliases.push({ short: shortFlag, long: longFlag });

		if (longFlag) {
			const flag = { name: longFlag };
      flags.push(flag);

			if (shortFlag)
				flag.alias = shortFlag;

			if (description) {
        const result = /(.*)  +(.*)/.exec(description);
        if (result) {
          flag.description = result[2].trim();
          flag.type = result[1].trim();
        } else {
  				flag.description = description.trim();
        }
			}
		}
	}
  const commandsRegex = /^(?:Management )?Commands:\n((?:  .* +.*\n)*)/gm;
  const commands = [];
  while (result = commandsRegex.exec(help)) {
    for (const match of result[1].split('\n')) {
      const result = /  ([^\s\*]+)\*? +(.*)/gm.exec(match);
      if (!result)
        continue;
      const [, name, description] = result;
      commands.push({ name, description, ...parseHelp(command, ...args, name) });
    }
  }
	return {
    flags,
    aliases,
    commands,
  };
}