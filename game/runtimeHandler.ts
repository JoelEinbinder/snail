import type { ClientMethods } from '../src/JSConnection';
import type { Protocol } from '../src/protocol';
const objectGroups = new Map<string, Set<string>>();
const objects = new Map<string, any>();
let lastObjectId = 0;
type ProtocolInterface = {
  [Key in keyof ClientMethods]?: (params: Parameters<ClientMethods[Key]>[0], dispatch: (message: {method: string, params: any}) => void) => Promise<ReturnType<ClientMethods[Key]>>;
};
export const runtimeHandler: ProtocolInterface = {
  async 'Runtime.evaluate'(params) {
    const {
      awaitPromise,
      contextId,
      expression,
      generatePreview,
      includeCommandLineAPI,
      objectGroup,
      returnByValue,
      silent,
      userGesture,
      allowUnsafeEvalBlockedByCSP,
      disableBreaks,
      replMode,
      throwOnSideEffect,
      timeout,
      uniqueContextId,
    } = params;
    try {
      if (throwOnSideEffect) {
        const match = /Object\((.*)\)/.exec(expression)?.[1];
        if (!match || match.includes('debugger') || !(/^[\.A-Za-z0-9_\s]*$/.test(match)))
          throw new Error('Side effect free eval is not supported');
      }
      let result = (self.eval)(expression);
      if (awaitPromise)
        result = await result;
      return {
        result: returnByValue ? serializeValue(result) : makeRemoteObject(result, generatePreview)
      };
    } catch (error) {
      return {
        result: { type: 'undefined' },
        exceptionDetails: { exceptionId: 0, text: '', lineNumber: 0, columnNumber: 0, exception: { type: 'object', description: error.toString() } }
      };
    }
  },
  async 'Runtime.getProperties'(params) {
    const { objectId, ownProperties, accessorPropertiesOnly, generatePreview, nonIndexedPropertiesOnly } = params;
    if (accessorPropertiesOnly || nonIndexedPropertiesOnly)
      return { result: [] };
    const properties: Protocol.Runtime.PropertyDescriptor[] = [];
    let obj = objects.get(objectId);
    const seen = new Set<string>();
    while (obj) {
      for (const name of Object.getOwnPropertyNames(obj)) {
        if (typeof obj.hasOwnProperty === 'function' && !obj.hasOwnProperty(name))
          continue;
        if (seen.has(name))
          continue;
        try {
          properties.push({
            name, value: makeRemoteObject(obj[name]), configurable: false, enumerable: true
          });
          seen.add(name);
        } catch(e) { }
      }
      if (ownProperties)
        obj = null;
      else
        obj = obj.__proto__;
    }
    return { result: properties, internalProperties: [{ name: '__proto__', value: makeRemoteObject(objects.get(objectId).__proto__) }] };
  },
  async 'Runtime.callFunctionOn'(params) {
    const {
      functionDeclaration,
      arguments: args,
      awaitPromise,
      executionContextId,
      generatePreview,
      objectGroup,
      objectId,
      returnByValue,
      silent,
      throwOnSideEffect,
      userGesture,
    } = params;
    try {
      if (throwOnSideEffect)
        throw new Error('Side effect free eval is not supported');
      const func: Function = (self.eval)('(' + functionDeclaration + ')');
      let result = func.call(objects.get(objectId!), ...(args || []).map(arg => {
        if (arg.objectId)
          return objects.get(arg.objectId);
        if ('value' in arg)
          return arg.value;
        return Number(arg.unserializableValue);
      }));
      if (awaitPromise)
        result = await result;
      return {
        result: returnByValue ? serializeValue(result) : makeRemoteObject(result)
      };
    } catch (error) {
      console.error(params, error);
      return {
        result: { type: 'undefined' },
        exceptionDetails: { exceptionId: 0, text: '', lineNumber: 0, columnNumber: 0, exception: { type: 'object', description: error.toString() } }
      };
    }
  },
  async 'Runtime.releaseObject'(params) {
    relaseObject(params.objectId);
    return { };
  },
  async 'Runtime.releaseObjectGroup'(params) {
    const group = objectGroups.get(params.objectGroup);;
    if (!group)
      return {};
    for (const objectId of group)
      relaseObject(objectId);
    objectGroups.delete(params.objectGroup);
    return {};
  },
  async 'Runtime.globalLexicalScopeNames'(params) {
    return {
      names: [], // TODO track this with acorn
    }
  },
  async 'Runtime.enable'(params, dispatch) {
    dispatch({ method: 'Runtime.executionContextCreated', params: { context: { id: 1, origin: '', name: 'game-worker' } } });
    return {};
  },
}
function relaseObject(id: string) {
  objectGroups.delete(id);
}
function makePreview(value: any): Protocol.Runtime.ObjectPreview {
  const properties = Object.entries(value);
  const maxProperties = 3;
  return {
    type: typeof value,
    overflow: properties.length > maxProperties,
    properties: properties.slice(0, maxProperties).map(([name, value]) => {
      if (value === null)
        return { name, type: 'object', subtype: 'null', value: 'null' };
      if (typeof value !== 'object')
        return { name, type: typeof value, value: String(value) };
      return { name, type: 'object', value: value.constructor.name };
    }),
  }
}
function makeRemoteObject(value, generatePreview=false): Protocol.Runtime.RemoteObject {
  if (value === null || !['object', 'function', 'symbol'].includes(typeof value))
    return serializeValue(value);
  const id = String(++lastObjectId);
  objects.set(id, value);
  const subtype = Array.isArray(value) ? 'array' : undefined;
  const className = (typeof value === 'object' && value.constructor) ? value.constructor.name : undefined;
  return {
    type: typeof value,
    subtype,
    className,
    description: typeof value === 'object' && className ? className : String(value),
    objectId: id,
    preview: generatePreview ? makePreview(value) : undefined,
  }
}

function serializeValue(value): Protocol.Runtime.RemoteObject {
  return {
    type: typeof value,
    subtype: value === null ? 'null' : undefined,
    description: Object.is(value, -0) ? "-0" : String(value),
    value: value
  }
}

export function hookConsole(dispatch: (message: {method: string, params: any}) => void) {
  console.log = makeConsoleHook('log');
  console.error = makeConsoleHook('error');
  console.warn = makeConsoleHook('warning');
  console.debug = makeConsoleHook('debug');
  console.info = makeConsoleHook('info');  

  function makeConsoleHook(type: Protocol.Runtime.consoleAPICalledPayload['type']) {
    return (...args) => {
      dispatch({ method: 'Runtime.consoleAPICalled', params: { type: type, args: args.map(arg => makeRemoteObject(arg, true)), executionContextId: 1, timestamp: Date.now() } });
    }
  }
}