import {Protocol} from './protocol';
import { RPC } from './RPC';

type ExtraServerMethods = {
  'Shell.daemonStatus': { isDaemon: boolean };
  // TODO start typing these methods
  'Shell.notify': { payload: any; };
  'Shell.cwdChanged': { cwd: string; };
}
type ServerMethods = Protocol.Events & ExtraServerMethods;

type ExtraClientMethods = {
  'Shell.enable': (parmas: {args: string[]}) => {objectId: string};
  'Shell.disable': () => void;
  'Shell.setIsDaemon': (params: {isDaemon: boolean}) => void;
  'Shell.evaluate': (params: {code: string}) => {result: string};
  'Shell.runCommand': (params: {command: string, expression: string}) => Protocol.CommandReturnValues['Runtime.evaluate'];
  'Shell.restore': () => Protocol.CommandReturnValues['Runtime.evaluate']|null;
}

type ClientMethods = {
  [key in keyof Protocol.CommandParameters]: (params: Protocol.CommandParameters[key]) => Protocol.CommandReturnValues[key];
} & ExtraClientMethods;

export class JSConnection extends RPC<ClientMethods, ServerMethods> {
}
