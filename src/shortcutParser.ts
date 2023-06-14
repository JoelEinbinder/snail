export type ParsedShortcut = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  key: string;
  continuation?: ParsedShortcut;
}
export function shortcutParser(shortcut: string, isMac: boolean): ParsedShortcut {
  const parsed: ParsedShortcut = {
    key: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  };
  let buffer = '';
  for (let i = 0; i < shortcut.length; i++) {
    const char = shortcut[i];
    if (!buffer.length) {
      buffer += char;
      continue;
    }
    if (char === '+') {
      if (buffer === 'CmdOrCtrl') {
        if (isMac)
          parsed.metaKey = true;
        else
          parsed.ctrlKey = true;
      } else if (buffer === 'Meta' || buffer === 'Cmd') {
        parsed.metaKey = true;
      } else if (buffer === 'Ctrl' || buffer === 'Control') {
        parsed.ctrlKey = true;
      } else if (buffer === 'Alt') {
        parsed.altKey = true;
      } else if (buffer === 'Shift') {
        parsed.shiftKey = true;
      } else {
        throw new Error('Invalid shortcut: ' + shortcut);
      }
      buffer = '';
    } else if (char === ' ') {
      parsed.key = buffer;
      parsed.continuation = shortcutParser(shortcut.substring(i + 1), isMac);
      break;
    } else {
      buffer += char;
    }
  }
  parsed.key = buffer;
  if (!buffer)
    throw new Error('Invalid shortcut: ' + shortcut);
  return parsed;
}