import { host } from "./host";

type HistoryItem = {
  command: string;
  start?: number;
}

export async function searchHistory(current: string, prefix: string, start: number, direction: number) {
  const max = (await host.sendMessage({
    method: 'queryDatabase',
    params: {
      sql: `SELECT MAX(command_id) FROM history`,
      params: [],
    }
  }))[0]['MAX(command_id)'];
  const escapedPrefix = prefix.replace(/[\\%_]/g, '\\$&') + '%';
  if (direction === 1) {
    const result = await host.sendMessage({
      method: 'queryDatabase',
      params: {
        sql: `SELECT command_id, command FROM history WHERE command LIKE ? ESCAPE '\\' AND command_id < ? AND command != ? ORDER BY command_id DESC LIMIT 1`,
        params: [escapedPrefix, max - start + 1, current],
      }
    });
    if (result.length === 0)
      return 'end';
    return {
      command: result[0].command,
      historyIndex: max - result[0].command_id + 1,
    }
  } else {
    const result = await host.sendMessage({
      method: 'queryDatabase',
      params: {
        sql: `SELECT command_id, command FROM history WHERE command LIKE ? ESCAPE '\\' AND command_id > ? AND command != ? ORDER BY command_id ASC LIMIT 1`,
        params: [escapedPrefix, max - start + 1, current],
      }
    });
    if (result.length === 0)
      return 'current';
    return {
      command: result[0].command,
      historyIndex: max - result[0].command_id + 1,
    }
  }
}

export async function addHistory(command: string): Promise<number> {
  const item: HistoryItem = {
    command,
    start: Date.now(),
  };
  const id = await host.sendMessage({
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
  await host.sendMessage({
    method: 'updateHistory',
    params: {
      id,
      col,
      value
    },
  });
}