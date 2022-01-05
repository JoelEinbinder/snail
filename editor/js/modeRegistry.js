const modes = new Map();
export function registerMode(extension, mode) {
  modes.set(extension, mode);
}
export function getMode(extension) {
  return modes.get(extension) || null;
}
