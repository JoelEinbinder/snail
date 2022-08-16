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
};