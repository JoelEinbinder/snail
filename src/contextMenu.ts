import { host } from "./host";
export type MenuItem = {
  title?: string;
  enabled?: boolean;
  checked?: boolean;
  value?: string;
  callback?: () => void;
  submenu?: MenuItem[];
};
export async function showContextMenu(items: MenuItem[]) {
  const values = new Map<number, string|(() => void)>();
  const callbacks = new Map<number, () => void>();
  let lastCallbackId = 0;
  function convertMenuItems(menuItems: MenuItem[]) {
    return menuItems.map(item => {
      const callback = (item.callback || item.value) ? ++lastCallbackId : undefined;
      if (item.value)
        values.set(callback, item.value);
      if (item.callback)
        callbacks.set(callback, item.callback);
      return {
        ...item,
        submenu: item.submenu ? convertMenuItems(item.submenu) : undefined,
        value: undefined,
        callback,
      };
    });
  }
  const {id} = await host.sendMessage({method: 'contextMenu', params: {menuItems: convertMenuItems(items)}});
  callbacks.get(id)?.();
  return values.get(id);
}
