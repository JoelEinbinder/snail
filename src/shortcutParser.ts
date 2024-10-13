function computeIsMac() {
  // hacky lazy compute so that we can use this file from node in tests
  return navigator['userAgentData']?.platform === 'macOS' || navigator.platform === 'MacIntel';
}

export type ParsedShortcut = {
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  key: string;
  continuation?: ParsedShortcut;
}
export function shortcutParser(shortcut: string, isMac = computeIsMac()): ParsedShortcut {
  const parsed: ParsedShortcut = {
    key: '',
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
export function formatShortcut(shortcut: ParsedShortcut) {
  const isMac = computeIsMac();
  const parts = [];
  if (isMac) {
    if (shortcut.metaKey)
      parts.push('⌘');
    if (shortcut.ctrlKey)
      parts.push('⌃');
    if (shortcut.altKey)
      parts.push('⌥');
    if (shortcut.shiftKey)
      parts.push('⇧');
  } else {
    if (shortcut.metaKey)
      parts.push('Win');
    if (shortcut.ctrlKey)
      parts.push('Ctrl');
    if (shortcut.altKey)
      parts.push('Alt');
    if (shortcut.shiftKey)
      parts.push('Shift');
  }
  if (isMac && shortcut.key === 'Tab')
    parts.push('⇥');
  else
    parts.push(shortcut.key);
  const joined = parts.join(' ');
  if (!shortcut.continuation)
    return joined;
  return joined + ' ' + formatShortcut(shortcut.continuation);
}