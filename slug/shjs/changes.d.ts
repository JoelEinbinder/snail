export type Changes = {
  env?: {[key: string]: string|null};
  aliases?: {[key: string]: string[]};
  cwd?: string;
  nod?: string[];
  ssh?: { sshAddress: string, sshArgs: string[], env: {[key: string]: string | undefined} };
  reconnect?: string;
  code?: string;
  exit?: number;
  bashState?: string;
  bashFunctions?: string[];
}
