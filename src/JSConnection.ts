import {Protocol} from './protocol';
import { RPC } from './RPC';

type ExtraServerMethods = {
  'Shell.daemonStatus': { isDaemon: boolean };
  // TODO start typing these methods
  'Shell.notify': { payload: any; };
  'Shell.cwdChanged': { cwd: string; };
  
  'Shell.subshellDestroyed': { id: number };
  'Shell.messageFromSubshell': { id: number, message: any };
  'Shell.askPassword': { id: number, message: string };
}
type ServerMethods = Protocol.Events & ExtraServerMethods;

export type ExtraClientMethods = {
  'Shell.enable': (parmas: {args: string[]}) => {objectId: string};
  'Shell.disable': () => void;
  'Shell.setIsDaemon': (params: {isDaemon: boolean}) => void;
  'Shell.evaluate': (params: {code: string}) => {result: string};
  'Shell.runCommand': (params: {command: string, expression: string}) => Protocol.CommandReturnValues['Runtime.evaluate'];
  'Shell.restore': () => Protocol.CommandReturnValues['Runtime.evaluate']|null;

  'Shell.resolveFileForIframe': (params: {shellIds: number[], filePath: string, search: string, headers: Record<string, string>}) => void;
  'Shell.createSubshell': (params: { sshAddress: string, sshArgs: string[], env: Record<string, string> }) => ({id: number}|{exitCode: number});
  'Shell.sendMessageToSubshell': (params: {id: number, message: {method: string, params: any}}) => void;
  'Shell.destroySubshell': (params: {id: number}) => void;
  'Shell.providePassword': (params: { id: number, password: string }) => void;
}

type ClientMethods = {
  [key in keyof Protocol.CommandParameters]: (params: Protocol.CommandParameters[key]) => Protocol.CommandReturnValues[key];
} & ExtraClientMethods;

export class JSConnection extends RPC<ClientMethods, ServerMethods> {
}
