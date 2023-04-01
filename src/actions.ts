import { rootBlock } from "./GridPane";

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
export type Action = {
  id: string;
  title: string;
  shortcut?: string;
  callback: () => void;
}

document.addEventListener('keydown', event => {
  const isMac = navigator['userAgentData']?.platform === 'macOS';
  const action = availableActions().find(x => {
    if (!x.shortcut)
      return false;
    const parts = x.shortcut.split('+');
    for (const part of parts) {
      if (part === 'CtrlOrCmd') {
        if (isMac ? !event.metaKey : !event.ctrlKey)
          return false;
      } else if (part === 'Ctrl') {
        if (!event.ctrlKey)
          return false;
      } else if (part === 'Meta' || part === 'Cmd') {
        if (!event.metaKey)
          return false;
      } else if (part === 'Alt') {
        if (!event.altKey)
          return false;
      } else if (part === 'Shift') {
        if (!event.shiftKey)
          return false;
      } else {
        if (event.key.toLowerCase() !== part.toLowerCase())
          return false;
      }
    }
    return true;
  });
  if (!action)
    return;
  event.preventDefault();
  event.stopImmediatePropagation();
  action.callback();
})