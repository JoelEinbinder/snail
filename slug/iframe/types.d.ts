declare var snail: {
  waitForMessage<T>(): Promise<T>;
  setHeight(height: number): void;
  setIsFullscreen(isFullscreen: boolean): void;
  sendInput(input: string): void;
  createContextMenu(items: import('../../host/ShellHost').MenuItem[], noDefaultItems?: boolean): void;
  saveItem(key: string, value: any): void;
  loadItem(key: string): Promise<any>;
  getDevicePixelRatio(): Promise<number>;
  attachToCDP(listener: {onMessage: (message: any, browserViewUUID?: string) => void, onDebuggeesChanged: (debuggees: {[key: string]: import('../../src/CDPManager').DebuggingInfo}) => void}): Promise<(message: any, browserViewUUID?: string) => void>;
  openDevTools(): void;
  setToJSON(toJSON: any | (()=>any)): void;
  setActions(actions: import('../../src/actions').Action[] | (()=>import('../../src/actions').Action[])): void;
  startAsyncWork(name?: string): () => void;
  expectingUserInput(name?: string): () => void;
  tryToRunCommand(command: string): Promise<void>;
  close(): void;
  setFindHandler(findHandler: (params: import('../../src/Find').FindParams|null) => void): void;
  setAdoptionHandler(adoptionHandler: () => void|Promise<void>): void;
  fillWithLLM(params: {
    before: string,
    after: string,
    useTerminalContext?: boolean,
    signal?: AbortSignal,
    language: string,
  }): AsyncIterable<string>;
};