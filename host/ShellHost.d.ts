import type { MenuItem } from '../slug/sdk/web';
import type { LLMMessage } from '../src/LogItem';
export interface ShellHost {
  obtainWebSocketId(): number;
  createJSShell(params: {cwd: string, socketId: number}): void;
  sendMessageToWebSocket(params: {socketId: number, message: { method: string; params: any; id: number; }}): void;
  destroyWebsocket(params: {socketId: number}): void;
  addHistory(item: {command: string, start: number, language: 'shjs'|'python'|'javascript'|'bash'}): number;
  queryDatabase(params: {sql: string, params: any[]}): any[];
  updateHistory(params: {id: number, col: string, value: string|number}): number;
  searchHistory(params: {current: string, prefix: string, start: number, firstCommandId: number, direction: number}): 'end'|'current'|{command: string, historyIndex: number, language: 'shjs'|'python'|'javascript'|'bash'};
  urlForIFrame(params: {shellIds: number[], filePath: string}): string;
  saveItem(params: {key: string, value: any}): number;
  loadItem(params: {key: string}): any;
  
  focusMainContent(): void;
  beep(): void;
  setProgress(params: {progress: number}): void;
  contextMenu(params: {menuItems: MenuItem[]}): { id: number };
  requestInspect(params: {uuid?: string}): void;
  refreshBrowserView(params: { uuid: string }): void;
  backBrowserView(params: { uuid: string }): void;
  forwardBrowserView(params: { uuid: string }): void;
  setBrowserViewURL(params: { uuid: string, url: string }): void;
  setBrowserViewRect(params: { uuid: string, rect: {x: number, y: number, width: number, height: number} }): void;
  postBrowserViewMessage(params: { uuid: string, message: any }): void;
  destroyBrowserView(params: { uuid: string }): void;
  focusBrowserView(params: { uuid: string }): void;
  createBrowserView(uuid: string): void;
  hideBrowserView(params: { uuid: string }): void;
  showBrowserView(params: { uuid: string }): void;

  close(params: {}): void;
  positionPanel(params: { top: number, bottom: number, x: number}): boolean;
  destroyPopup(params: {}): void;
  resizePanel(params: {width: number, height: number}): void;
  sendMessageToCDP(params: {browserViewUUID?: string, message: any}): void;
  attachToCDP(params: {browserViewUUID?: string}): void;
  detachFromCDP(params: {browserViewUUID?: string}): void;

  setMaximized(params: {maximized: boolean}): void;
  minimize(): void;
  switchToTab(params: {tabNumber: number}): void;

  captureImage(params: { rect: {x: number, y: number, width: number, height: number} }): { data: string };

  reportTime(params: {name: string}): void;

  streamFromLLM(params: {
    model: string,
    system: string,
    messages: LLMMessage[],
    tool_choice?: string,
    tools?: import('openai').OpenAI.FunctionDefinition[],
    apiKey: string,
  }): AsyncIterable<string>;
  fillWithLLM(params: {model: string, prompt: string, suffix: string, apiKey: string}): AsyncIterable<string>;
}
