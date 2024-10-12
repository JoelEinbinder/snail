import {Protocol} from './protocol';
import { RPC, Transport } from '../slug/protocol/RPC-ts';
import type { Runtime } from '../slug/shell/runtime-types';

type ExtraServerMethods = {
  'Shell.daemonStatus': { isDaemon: boolean };
  'Shell.notify': { payload: { method: keyof Runtime , params: any }};
  
  'Shell.subshellDestroyed': { id: number };
  'Shell.messageFromSubshell': { id: number, message: any };
  'Shell.askPassword': { id: number, message: string };

  'Shell.evaluateStreamingData': { streamId: number, data: string };
  'Shell.evaluateStreamingEnd': { streamId: number };

  'Shell.willPushEvaluation': { id: number, code: string };
  'Shell.pushEvaluation': { id: number, result: string, exitCode: number };
}
type ServerMethods = Protocol.Events & ExtraServerMethods;

export type ExtraClientMethods = {
  'Shell.enable': (params: {args: string[], env: {[key: string]: string}}) => void;
  'Shell.disable': () => void;
  'Shell.input': (params: {data: string, id: string|number}) => void;
  'Shell.resize': (params: {rows: number, cols: number}) => void;
  'Shell.setIsDaemon': (params: {isDaemon: boolean}) => void;
  'Shell.evaluate': (params: {code: string}) => {result: string, exitCode: number};
  'Shell.evaluateStreaming': (params: {code: string}) => {streamId: number};
  'Shell.runCommand': (params: {command: string, expression: string, language: 'shjs'|'javascript'|'python'|'bash'}) => Protocol.CommandReturnValues['Runtime.evaluate'];
  'Shell.previewCommand': (params: {command: string}) => { result: Protocol.CommandReturnValues['Runtime.evaluate'], notifications: any[]};
  'Shell.restore': () => Protocol.CommandReturnValues['Runtime.evaluate']|null;
  'Shell.setCwd': (params: {cwd: string}) => void; // this can be run before Shell.enable

  'Shell.resolveFileForIframe': (params: {shellIds: number[], filePath: string, search: string, headers: Record<string, string>}) => void;
  'Shell.createSubshell': (params: { sshAddress: string, sshArgs: string[], env: Record<string, string> } | { socketPath: string }) => ({id: number}|{exitCode: number});
  'Shell.sendMessageToSubshell': (params: {id: number, message: {method: string, params: any, id?: number}}) => void;
  'Shell.destroySubshell': (params: {id: number}) => void;
  'Shell.providePassword': (params: { id: number, password: string }) => void;

  'Shell.kill': () => void;

  'Python.autocomplete': (params: {line: string}) => {
    anchor: number,
    suggestions: {text: string, description?: string}[]
  };
  'Python.isUnexpectedEndOfInput': (params: {code: string}) => boolean;
  'Python.reset': () => void;

  'Protocol.abort': (params: { id: number }) => void;
}

export type ClientMethods = {
  [key in keyof Protocol.CommandParameters]: (params: Protocol.CommandParameters[key]) => Protocol.CommandReturnValues[key];
} & ExtraClientMethods;

export class JSConnection extends RPC<ClientMethods, ServerMethods> {
  constructor(transport: Transport) {
    super(transport, id => this.send('Protocol.abort', {id}));
  }
}
