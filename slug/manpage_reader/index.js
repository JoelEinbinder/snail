const path = require('path');
const fs = require('fs');
const {spawnSync} = require('child_process');
const paths = spawnSync('manpath').stdout.toString().trim().split(':').filter(x => x);

/**
 * @param {string} command
 */
function manPathForCommand(command) {
  for (const searchPath of paths) {
    for (const searchDir of ['1', '8', '1.gz', '8.gz']) {
      const manPath = path.join(searchPath, 'man' + searchDir[0], `${command}.${searchDir}`);
      const exists = fs.existsSync(manPath);
      if (exists)
        return manPath;
    }
  }
  return null;
}
/**
 * @param {string} command
 */

function descriptionOfCommand(command) {
  return descriptionOfManpage(manPathForCommand(command));
}

/**
 * @param {string} manPath
 * @return {string}
 */
function readManpage(manPath) {
  if (!manPath.endsWith('.gz'))
    return fs.readFileSync(manPath, 'utf8');
  return spawnSync('gunzip', ['-c', manPath]).stdout.toString();
}
function descriptionOfManpage(manPath) {
  if (!manPath)
    return null;
  const lines = readManpage(manPath).split('\n');
  if (lines.length < 10) {
    for (const line of lines) {
      const match = /^.so (.*)$/i.exec(line);
      if (match) {
        const newPath = path.join(manPath, '..', '..', match[1]);
        return descriptionOfManpage(newPath);
      }
    }
  }
  let subheading = null;
  let description = '';
  for (const line of lines) {
    const {content, macro} = parseLine(line);
    if (macro === '.SH') {
      if (subheading === '"NAME"' || subheading === 'NAME')
        return processDescription();
      subheading = content.trim().split(/\s/)[0].toUpperCase();
    } else if (subheading === '"NAME"' || subheading === 'NAME') {
      if (macro === '.ND')
        return content.trim()
      if (new Set(['.SP', '.SS', '.NR', '.BR']).has(macro))
        return processDescription();
      if (macro === '.\\"')
        continue;
      description += ' ' + content.trim();      
    }
  }
  function processDescription() {
    const dash = description.indexOf('- ');
    if (dash !== -1)
      return description.substring(dash + '- '.length).trim();
    return description.trim();
  }
  return processDescription();

  function parseLine(line) {
    let macro = null;
    let i = 0;
    if (line.startsWith('.')) {
      macro = '';
      while (i < line.length && line[i] !== ' ') {
        macro += line[i].toUpperCase();
        i++;
      }
      i++;
    }
    let content = '';
    while (i < line.length) {
      const char = line[i];
      if (char == '\\') {
        content += line[i + 1];
        i++;
      } else if (char === '#') {
        break;
      } else if (char === '/' && line[i + 1] === '/') {
        break;
      } else {
        content += char;
      }
      i++;
    }
    return {macro, content}
  }
}

// function *allCommands() {
//   for (const searchPath of paths) {
//     const files = fs.readdirSync(path.join(searchPath, 'man1'));
//     for (const file of files) {
//       const regex = /^(.+)\.1$/;
//       const match = regex.exec(file);
//       if (match)
//         yield match[1];
//     }
//   }
// }

module.exports = {descriptionOfCommand};