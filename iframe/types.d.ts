type MenuItem = {
  title?: string;
  enabled?: boolean;
  checked?: boolean;
  callback?: () => void;
  submenu?: MenuItem[];
};
declare var d4: {
  waitForMessage<T>(): Promise<T>;
  setHeight(height: number): void;
  setIsFullscreen(isFullscreen: boolean): void;
  sendInput(input: string): void;
  createContextMenu(items: MenuItem[]): void;
  saveItem(key: string, value: any): void;
  loadItem(key: string): Promise<any>;
  getDevicePixelRatio(): Promise<number>;
  attachToCDP(listener: {onMessage: (message: any, browserViewUUID?: string) => void, onDebuggeesChanged: (debuggees: {[key: string]: import('../src/CDPManager').DebuggingInfo}) => void}): Promise<(message: any, browserViewUUID?: string) => void>;
  openDevTools(): void;
};