export type CommandFunction = () => boolean;

export class CommandManager {
  private _commands = new Map<string, CommandFunction>();
  private _shortcuts: {shortcut: string, command: string}[] = [];
  constructor(parent: HTMLElement) {
    this._commands = new Map();
    this._shortcuts = [];

    parent.addEventListener(
      'keydown',
      event => {
        var shortcut = this._eventToString(event);
        for (var i = this._shortcuts.length - 1; i >= 0; i--) {
          if (this._shortcuts[i].shortcut !== shortcut) continue;
          if (this._commands.get(this._shortcuts[i].command)!()) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
      },
      false
    );
  }

  trigger(command: string): boolean {
    if (!this._commands.has(command)) throw new Error('Unknown command "' + command + '"');
    return this._commands.get(command)!();
  }

  addCommand(commandFunction: CommandFunction, command: string, shortcut?: (string | string[]), macShortcut?: (string | string[])) {
    this._commands.set(command, commandFunction);
    this.registerShortcut(command, shortcut, macShortcut);
  }

  registerShortcut(command: string, shortcuts?: (string | string[]), macShortcuts?: (string | string[])) {
    console.assert(this._commands.has(command), `Command not found "${command}"`);
    if (macShortcuts && navigator.platform.indexOf('Mac') > -1) shortcuts = macShortcuts;
    if (!shortcuts) return;
    if (typeof shortcuts === 'string') shortcuts = [shortcuts];
    for (const shortcut of shortcuts)
      this._shortcuts.push({ shortcut: shortcut.toLowerCase(), command });
  }

  _eventToString(event: KeyboardEvent) {
    var str = event.key.toLowerCase();
    if (event.ctrlKey) str = 'ctrl+' + str;
    if (event.shiftKey) str = 'shift+' + str;
    if (event.altKey) str = 'alt+' + str;
    if (event.metaKey) str = 'meta+' + str;
    return str;
  }
}
