import type { Mode } from './highlighter';
const modes = new Map();
export function registerMode<T = any>(extension: string, mode: (config: {indentUnit: number}, parserConfig: any) => Mode<T>) {
  modes.set(extension, mode);
}
export function getMode(extension: string): (config: {indentUnit: number}, parserConfig: any) => Mode<any> {
  return modes.get(extension) || null;
}
