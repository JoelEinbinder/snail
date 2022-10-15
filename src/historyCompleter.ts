import type { Completer, CompletionResult, Suggestion } from "./autocomplete";
import type { Shell } from "./Shell";
import { host } from "./host";

export function makeHistoryCompleter(shell: Shell): Completer {
  return async (line: string, abortSignal: AbortSignal) => {
    const escapedPrefix = line.replace(/[\\%_]/g, '\\$&') + '%';

    const params = [];
    if (shell.sshAddress)
      params.push(shell.sshAddress);
    params.push(escapedPrefix);
    const commandSuffix = `
    ORDER BY
      CASE WHEN command LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
      CASE WHEN ${shell.sshAddress ? 'hostname = ?' : 'hostname IS NULL'} THEN 0 ELSE 1 END,
      command_id DESC`
    const rows: {command: string}[] = await host.sendMessage({
      method: 'queryDatabase',
      params: {
        sql: `SELECT DISTINCT command
          FROM history
          WHERE command LIKE ? ESCAPE '\\'
          ${commandSuffix}`,
        params: ['%' + escapedPrefix , ...params],
      }
    });
    return {
      anchor: 0,
      suggestions: rows.map(row => ({
        text: row.command,
        description: async () => {
          const [{start, hostname}] = await host.sendMessage({
            method: 'queryDatabase',
            params: {
              sql: `SELECT start, hostname
                FROM history
                WHERE command = ?
                ${commandSuffix}
                LIMIT 1`,
              params: [row.command, ...params],
            }
          });
          const date = new Date(start);
          const month = date.toLocaleDateString(undefined, {
            month: 'short',
          });
          const day = date.toLocaleDateString(undefined, {
            day: 'numeric',
          });
          const year = date.toLocaleDateString(undefined, {
            year: 'numeric',
          });
          const time = date.toLocaleTimeString(undefined, {
            timeStyle: 'short',
          });
          const isSameYear = new Date().getFullYear() === date.getFullYear();
          const parts = [`${month} ${day.padStart(2, ' ')} ${isSameYear ? time : year}`];
          if (hostname)
            parts.push(hostname);
          return parts.join('\n');
        }
      })),
      exact: true,
      preFiltered: true,
      cssTag: 'history',
    }
  };
}