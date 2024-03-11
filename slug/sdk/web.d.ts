export type MenuItem = {
  title?: string;
  enabled?: boolean;
  checked?: boolean;
  callback?: () => void;
  submenu?: MenuItem[];
};

export type Action = {
  id: string;
  title: string;
  shortcut?: string;
  callback: () => void;
};

export type FindParams = { regex: RegExp, report: (matches: number) => void };

export type DebuggingInfo = {
  browserViewUUID?: string;
  frameUUID?: string;
  type: 'webkit'|'chromium'|'node';
};

export function waitForMessage<T>(): Promise<T>;
export function setHeight(height: number): void;
export function setIsFullscreen(isFullscreen: boolean): void;
export function sendInput(input: string): void;
export function createContextMenu(items: MenuItem[], noDefaultItems?: boolean): void;
export function saveItem(key: string, value: any): void;
export function loadItem(key: string): Promise<any>;
export function getDevicePixelRatio(): Promise<number>;
export function attachToCDP(listener: {onMessage: (message: any, browserViewUUID?: string) => void, onDebuggeesChanged: (debuggees: {[key: string]: DebuggingInfo}) => void}): Promise<(message: any, browserViewUUID?: string) => void>;
export function openDevTools(): void;
export function setToJSON(toJSON: any | (()=>any)): void;
export function setActions(actions: Action[] | (()=>Action[])): void;
export function startAsyncWork(name?: string): () => void;
export function expectingUserInput(name?: string): () => void;
export function tryToRunCommand(command: string): Promise<void>;
export function close(): void;
export function setFindHandler(findHandler: (params: FindParams|null) => void);
