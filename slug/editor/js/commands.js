/**
 * @typedef {function():boolean} CommandFunction
 */
export class CommandManager {
  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    /** @type {Map<string, CommandFunction>} */
    this._commands = new Map();
    /** @type {Array<{shortcut: string, command: string}>} */
    this._shortcuts = [];

    parent.addEventListener(
      'keydown',
      event => {
        var shortcut = this._eventToString(event);
        for (var i = this._shortcuts.length - 1; i >= 0; i--) {
          if (this._shortcuts[i].shortcut !== shortcut) continue;
          if (this._commands.get(this._shortcuts[i].command)()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
      },
      false
    );
  }

  /**
   * @param {string} command
   * @return {boolean}
   */
  trigger(command) {
    if (!this._commands.has(command)) throw new Error('Unknown command "' + command + '"');
    return this._commands.get(command)();
  }

  /**
   * @param {CommandFunction} commandFunction
   * @param {string} command
   * @param {(string|string[])=} shortcut
   * @param {(string|string[])=} macShortcut
   */
  addCommand(commandFunction, command, shortcut, macShortcut) {
    this._commands.set(command, commandFunction);
    this.registerShortcut(command, shortcut, macShortcut);
  }

  /**
   * @param {string} command
   * @param {(string|string[])} shortcuts
   * @param {(string|string[])=} macShortcuts
   */
  registerShortcut(command, shortcuts, macShortcuts) {
    console.assert(this._commands.has(command), `Command not found "${command}"`);
    if (macShortcuts && navigator.platform.indexOf('Mac') > -1) shortcuts = macShortcuts;
    if (!shortcuts) return;
    if (typeof shortcuts === 'string') shortcuts = [shortcuts];
    for (const shortcut of shortcuts)
      this._shortcuts.push({ shortcut: shortcut.toLowerCase(), command });
  }

  /**
   * @param {KeyboardEvent} event
   */
  _eventToString(event) {
    var str = event.key.toLowerCase();
    if (event.ctrlKey) str = 'ctrl+' + str;
    if (event.shiftKey) str = 'shift+' + str;
    if (event.altKey) str = 'alt+' + str;
    if (event.metaKey) str = 'meta+' + str;
    return str;
  }
}