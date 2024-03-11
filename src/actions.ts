import { rootBlock } from "./GridPane";
import { shortcutParser, type ParsedShortcut } from './shortcutParser';

import type { Action } from '../slug/sdk/web';
export type { Action } from '../slug/sdk/web';

const globalActions: Action[] = [];
export function registerGlobalAction(action: Action): void {
  const existing = globalActions.findIndex(a => a.id === action.id);
  if (existing !== -1)
    globalActions.splice(existing, 1);
  globalActions.push(action);
}
export function availableActions(): Action[] {
  const actions = [...rootBlock.actions(), ...globalActions];
  const seenIds = new Set<string>();
  return actions.filter(action => {
    if (seenIds.has(action.id))
      return false;
    seenIds.add(action.id);
    return true;
  });
}

let continuationActions: {shortcut: ParsedShortcut, action: Action}[] = null;

export function getCurrentShortcutActions() {
  const isMac = navigator['userAgentData']?.platform === 'macOS';
  return  continuationActions ? continuationActions : availableActions().filter(x => x.shortcut).map(x => {
    return {shortcut: shortcutParser(x.shortcut, isMac), action: x};
  });
}
document.addEventListener('keydown', event => {
  const currentActions = getCurrentShortcutActions();
  const matchingActions = currentActions.filter(x => {
    const parsed = x.shortcut;
    if (parsed.ctrlKey !== undefined && parsed.ctrlKey !== event.ctrlKey)
      return false;
    if (parsed.metaKey !== undefined && parsed.metaKey !== event.metaKey)
      return false;
    if (parsed.altKey !== undefined && parsed.altKey !== event.altKey)
      return false;
    if (parsed.shiftKey !== undefined && parsed.shiftKey !== event.shiftKey)
      return false;
    if (parsed.key.toLowerCase() !== event.key.toLowerCase() && parsed.key !== event.code)
      return false;
    return true;
  });
  if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Meta')
    continuationActions = null;
  if (!matchingActions.length)
    return;
  matchingActions.sort((a, b) => {
    function scoreShortcut(shortcut: ParsedShortcut) {
      let score = 0;
      if (shortcut.shiftKey !== undefined)
        score++;
      if (shortcut.ctrlKey !== undefined)
        score++;
      if (shortcut.altKey !== undefined)
        score++;
      if (shortcut.metaKey !== undefined)
        score++;
      return score;
    }
    return scoreShortcut(b.shortcut) - scoreShortcut(a.shortcut);
  });
  event.preventDefault();
  event.stopImmediatePropagation();
  const completeAction = matchingActions.find(x => !x.shortcut.continuation);
  if (completeAction) {
    continuationActions = null;
    completeAction.action.callback();
  } else {
    continuationActions = matchingActions.map(x => {
      return {shortcut: x.shortcut.continuation, action: x.action};
    });
  }
}, true);
