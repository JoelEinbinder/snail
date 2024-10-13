import { host } from "./host";
import type { Language } from "./Shell";

type HistoryItem = {
  command: string;
  language: Language;
  start?: number;
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

export class History {
  private _localHistory: HistoryItem[] = [];
  private _firstCommandId = Infinity;
  async addHistory(command: string, language: Language) {
    const item = {
      command,
      start: Date.now(),
      language,
    };
    const id = await host.sendMessage({
      method: 'addHistory',
      params: item,
    });
    this._firstCommandId = Math.min(this._firstCommandId, id);
    this._localHistory.unshift(item);
    return async<T extends keyof HistoryDatabaseItem>(col: T, value: HistoryDatabaseItem[T]) => {
      await host.sendMessage({
        method: 'updateHistory',
        params: {
          id,
          col,
          value
        },
      });
    };
  }
  async searchHistory(current: string, prefix: string, start: number, direction: -1|1): Promise<'end'|'current'|{command: string, historyIndex: number, language: Language}> {
    const searchLocalHistory = () => {
      let startIndex = start + direction - 1;
      if (direction === -1)
        startIndex = Math.min(startIndex, this._localHistory.length - 1);
      for (let i = startIndex; i < this._localHistory.length && i >= 0; i += direction) {
        const {command, language} = this._localHistory[i];
        if (current === command || !command.startsWith(prefix))
          continue;
        return {
          command,
          language,
          historyIndex: i + 1,
        }
      }
      if (direction === -1)
        return 'current';
      return 'end';  
    }
    const searchRemoteHistory = async () => {
      const result = await host.sendMessage({
        method: 'searchHistory',
        params: {
          current,
          prefix,
          start: start - this._localHistory.length,
          direction,
          firstCommandId: this._firstCommandId,
        }
      });
      if (result === 'current' || result === 'end')
        return result;
      return {
        command: result.command,
        language: result.language,
        historyIndex: result.historyIndex + this._localHistory.length,
      };
    }
    if (direction === 1) {
      const local = searchLocalHistory();
      if (local !== 'end')
        return local;
      return await searchRemoteHistory()
    } else {
      const remote = await searchRemoteHistory();
      if (remote !== 'current')
        return remote;
      return searchLocalHistory();
    }
  }

  async isNewCommand({ command, pwd, sshAddress }: { command: string, pwd: string, sshAddress: string|null }) {
    const result = await host.sendMessage({
      method: 'queryDatabase',
      params: {
        sql: `SELECT hostname FROM history WHERE end IS NOT NULL AND command = ? AND pwd = ? AND hostname ${sshAddress ? '= ?' : 'IS NULL'} LIMIT 1`,
        params: sshAddress ? [command, pwd, sshAddress] : [command, pwd],
      }
    });
    return result.length === 0;
  }
}
