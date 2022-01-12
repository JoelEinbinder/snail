type HistoryItem = {
  command: string;
  start: number;
}
export const historyPromise : Promise<HistoryItem[]> = (async() => {
  const history = await window.electronAPI.sendMessage({
    method: 'getHistory',
  });
  return history;
})();

export async function addHistory(command: string) {
  if (!command)
    return;
  const item: HistoryItem = {
    command,
    start: Date.now(),
  };
  (await historyPromise).push(item);
  await window.electronAPI.sendMessage({
    method: 'addHistory',
    params: item,
  });
}