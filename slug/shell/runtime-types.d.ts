export interface Runtime {
    startTerminal: { id: number, previewToken?: number };
    endTerminal: { id: number, previewToken?: number };
    data: { id: number, previewToken?: number, data: string };
    leftoverStdin: { id: number, previewToken?: number, data: string };

    cwd: string;
    env: { [key: string]: string };
    aliases: { [key: string]: string[] };
    nod: string[];
    ssh: { sshAddress: string, sshArgs: string[], env: NodeJS.ProcessEnv };
    reconnect: string;
    code: string;
}

type NotifyFunction = <T extends keyof Runtime>(method: T, params: Runtime[T]) => void;