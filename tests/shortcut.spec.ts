import { test, expect } from './fixtures';
import { ParsedShortcut, shortcutParser } from '../src/shortcutParser';
test('parse a simple shortcut', async ({}) => {
  expect(shortcutParser('A', false)).toEqual({
    key: 'A',
  } as ParsedShortcut);
});
test('have modifiers', async ({}) => {
  expect(shortcutParser('Ctrl+B', false)).toEqual({
    key: 'B',
    ctrlKey: true,
  } as ParsedShortcut);
  expect(shortcutParser('Alt+B', false)).toEqual({
    key: 'B',
    altKey: true,
  } as ParsedShortcut);
  expect(shortcutParser('Meta+B', false)).toEqual({
    key: 'B',
    metaKey: true,
  } as ParsedShortcut);
  expect(shortcutParser('Shift+B', false)).toEqual({
    key: 'B',
    shiftKey: true,
  } as ParsedShortcut);
});
test('should support CmdOrCtrl', async ({}) => {
  expect(shortcutParser('CmdOrCtrl+C', true)).toEqual({
    key: 'C',
    metaKey: true,
  } as ParsedShortcut);
  expect(shortcutParser('CmdOrCtrl+C', false)).toEqual({
    key: 'C',
    ctrlKey: true,
  } as ParsedShortcut);
});
test('should work with tricky shortcuts', async ({}) => {
  expect(shortcutParser('+', false)).toEqual({
    key: '+',
  } as ParsedShortcut);
  expect(shortcutParser('Ctrl++', false)).toEqual({
    key: '+',
    ctrlKey: true,
  } as ParsedShortcut);
});
test('should throw on invalid shortcuts', async ({}) => {
  expect(() => shortcutParser('Ctrl+', false)).toThrowError();
  expect(() => shortcutParser('++', false)).toThrowError();
  expect(() => shortcutParser('Foo+Bar', false)).toThrowError();
});
test('should support continuation', async ({}) => {
  expect(shortcutParser('Ctrl+A Ctrl+C', false)).toEqual({
    key: 'A',
    ctrlKey: true,
    continuation: {
      key: 'C',
      ctrlKey: true,
    },
  } as ParsedShortcut);
  expect(shortcutParser('Ctrl+A Ctrl+C Ctrl+V', false)).toEqual({
    key: 'A',
    ctrlKey: true,
    continuation: {
      key: 'C',
      ctrlKey: true,
      continuation: {
        key: 'V',
        ctrlKey: true,
      },
    },
  } as ParsedShortcut);
});