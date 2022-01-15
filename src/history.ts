type HistoryItem = {
  command: string;
  start?: number;
}
export const historyPromise : Promise<HistoryItem[]> = (async() => {
  const history = await window.electronAPI.sendMessage({
    method: 'getHistory',
  });
  return history;
})();

export async function addHistory(command: string): number {
  const item: HistoryItem = {
    command,
    start: Date.now(),
  };
  (await historyPromise).push(item);
  const id = await window.electronAPI.sendMessage({
    method: 'addHistory',
    params: item,
  });
  return id;
}

type HistoryDatabaseItem = {
  command_id: number,
  start: number,
  end: number,
  command: string,
  output: string,
  git_hash: string,
  git_branch: string,
  git_dirty: string,
  git_diff: string,
  pwd: string,
  home: string,
  username: string,
  hostname: string,
  exit_code: number,
}
export async function updateHistory<T extends keyof HistoryDatabaseItem>(id, col: T, value: HistoryDatabaseItem[T]) {
  await window.electronAPI.sendMessage({
    method: 'updateHistory',
    params: {
      id,
      col,
      value
    },
  });
}