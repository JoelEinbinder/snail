/// <reference path="../../node_modules/monaco-editor/monaco.d.ts" />
import { StringStream } from './StringStream';
import * as bundle from './build/lib';
const {ShjsMode} = bundle as typeof import('../../shjs/editorMode');

function copyState<T>(state: T, depth = 2): T {
  if (Array.isArray(state)) return state.slice(0) as T & any[];
  if (depth && typeof state === 'object' && state !== null) {
    const copy = {} as T;
    for (var i in state) {
      copy[i] = copyState(state[i], depth - 1);
    }
    return copy;
  }

  return state;
}

class State {
  constructor(public innerState: any) {
  }
  clone(): State {
    return new State(copyState(this.innerState));
  }
  equals(otherState: State) {
    return JSON.stringify(this.innerState) === JSON.stringify(otherState.innerState);
  }
}

function codeMirrorToMonacoTokenName(name: string) {
  const firstName = name.split(' ')[0];
  const map: {[key: string]: string} = {
    'sh': 'sh',
    'sh-replacement': 'variable',
    'sh-string': 'string',
    'sh-template': 'macro',
    'operator': 'operator',
    '': '',
    'keyword': 'keyword',
    'def': 'variable',
    'variable': 'variable',
    'variable-2': 'variable',
    'property': 'property',
    'string': 'string',
    'string-2': 'string',
    'number': 'number',
    'comment': 'comment',
    'atom': 'keyword',
  };
  if (!(firstName in map)) {
    console.warn('Unknown token name: ' + firstName);
    return firstName;
  }
  return map[firstName];
}

export function createTokenizer(): monaco.languages.TokensProvider {
  const mode = new ShjsMode({indentUnit: 2, globalVars: new Set([
    "global",
    "clearInterval",
    "clearTimeout",
    "setInterval",
    "setTimeout",
    "queueMicrotask",
    "performance",
    "clearImmediate",
    "setImmediate",
    "__filename",
    "module",
    "exports",
    "__dirname",
    "require",
    "sh",
    "pty",
    "Object",
    "Function",
    "Array",
    "Number",
    "parseFloat",
    "parseInt",
    "Infinity",
    "NaN",
    "undefined",
    "Boolean",
    "String",
    "Symbol",
    "Date",
    "Promise",
    "RegExp",
    "Error",
    "AggregateError",
    "EvalError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError",
    "globalThis",
    "JSON",
    "Math",
    "console",
    "Intl",
    "ArrayBuffer",
    "Uint8Array",
    "Int8Array",
    "Uint16Array",
    "Int16Array",
    "Uint32Array",
    "Int32Array",
    "Float32Array",
    "Float64Array",
    "Uint8ClampedArray",
    "BigUint64Array",
    "BigInt64Array",
    "DataView",
    "Map",
    "BigInt",
    "Set",
    "WeakMap",
    "WeakSet",
    "Proxy",
    "Reflect",
    "FinalizationRegistry",
    "WeakRef",
    "decodeURI",
    "decodeURIComponent",
    "encodeURI",
    "encodeURIComponent",
    "escape",
    "unescape",
    "eval",
    "isFinite",
    "isNaN",
    "process",
    "Buffer",
    "atob",
    "btoa",
    "URL",
    "URLSearchParams",
    "TextEncoder",
    "TextDecoder",
    "AbortController",
    "AbortSignal",
    "EventTarget",
    "Event",
    "MessageChannel",
    "MessagePort",
    "MessageEvent",
    "SharedArrayBuffer",
    "Atomics",
    "WebAssembly",
    "assert",
    "async_hooks",
    "buffer",
    "child_process",
    "cluster",
    "constants",
    "crypto",
    "dgram",
    "diagnostics_channel",
    "dns",
    "domain",
    "events",
    "fs",
    "http",
    "http2",
    "https",
    "inspector",
    "net",
    "os",
    "path",
    "perf_hooks",
    "punycode",
    "querystring",
    "readline",
    "repl",
    "stream",
    "string_decoder",
    "sys",
    "timers",
    "tls",
    "trace_events",
    "tty",
    "url",
    "util",
    "v8",
    "vm",
    "worker_threads",
    "zlib",
    "constructor",
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
    "__proto__",
    "toLocaleString"
  ])});
  console.log(mode);
  return {
    getInitialState() {
      return new State(mode.startState());
    },
    tokenize(line, state: any) {
      const stream = new StringStream(line);
      const tokens: {startIndex: number, scopes: string}[] = [];
      while (!stream.eol()) {
        const cmToken: string = mode.token(stream, state.innerState) || '';
        tokens.push({ startIndex: stream.start, scopes: codeMirrorToMonacoTokenName(cmToken) });
        stream.start = stream.pos;
      }
      // console.log(tokens);

      return {
        endState: state,
        tokens: tokens,
      }
    }
  }
}