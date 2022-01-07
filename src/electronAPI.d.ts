export interface IElectronAPI {
  sendMessage: (message: {method: string, params?: any}) => Promise<any>;
  onEvent: (listener: (event: any) => void) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
