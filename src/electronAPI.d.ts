export interface IElectronAPI {
  sendMessage: (message: {method: string, params?: any}) => Promise<any>;
  notify: (message: {method: string, params?: any}) => void;
  onEvent: (eventName: string, listener: (event: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
