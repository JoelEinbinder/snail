import { JoelEvent } from "./JoelEvent";
import type { JSConnection } from "../../src/JSConnection";
import type { LogItem } from "../../src/LogItem";
import type { Protocol } from "../../src/protocol";
import './remoteObject.css';
import type { FindParams } from "../../src/Find";
import { startAyncWork } from "../../src/async";

export class JSBlock implements LogItem {
  willResizeEvent = new JoelEvent<void>(undefined);
  private _element: HTMLElement;
  constructor(object: Protocol.Runtime.RemoteObject, private _connection: JSConnection, size: JoelEvent<{cols: number, rows: number}>) {
    this._element = renderRemoteObject(object, this._connection, this.willResizeEvent, size.current.cols - 1, true);
  }
  render(): Element {
    return this._element;
  }
  focus(): void {
  }
  dispose(): void {
  }
  async serializeForTest(): Promise<any> {
    return this._element.innerText;
  }
  setFind(params: FindParams): void {
  }
}

export class JSLogBlock implements LogItem {
  willResizeEvent = new JoelEvent<void>(undefined);
  private _element = document.createElement('div');
  constructor(log: Protocol.Runtime.consoleAPICalledPayload, connection: JSConnection, size: JoelEvent<{cols: number, rows: number}>) {
    this._element.style.whiteSpace = 'pre';
    let first = true;
    for (const arg of log.args) {
      if (first)
        first = false;
      else
        this._element.append(' ');
      if (arg.type === 'string')
        this._element.append(arg.value);
      else {
        const object = renderRemoteObject(arg, connection, this.willResizeEvent, size.current.cols - 1);
        if (object.tagName === 'DETAILS')
          object.style.display = 'inline-block';
        this._element.append(object);
      }
    }
  }
  render(): Element {
    return this._element;
  }
  focus(): void {
  }
  dispose(): void {
  }
  async serializeForTest(): Promise<any> {
    return this._element.textContent;
  }
  setFind(params: FindParams): void {
  }
}

function renderRemoteObject(object: Protocol.Runtime.RemoteObject, connection: JSConnection, willResize: JoelEvent<void>, charBudget: number, open = false): HTMLElement {
  switch (object.type) {
    case 'number':
    case 'bigint':
    case 'symbol':
    case 'undefined':
    case 'boolean':
      return renderBasicRemoteObject(object);
    case 'string':
      return renderStringRemoteObject(object);
    case 'object':
      if (object.subtype === 'null')
        return renderBasicRemoteObject(object);
      if (object.subtype === 'error')
        return renderErrorRemoteObject(object);
      return renderObjectRemoteObject(object, connection, willResize, charBudget, undefined, open);
    case 'function':
      return renderObjectRemoteObject(object, connection, willResize, charBudget);
    default:
      console.error('unknown', object);
      return document.createElement('div');
  }
}

function renderErrorRemoteObject(object: Protocol.Runtime.RemoteObject) {
  const span = document.createElement('span');
  span.classList.add('remote-object', 'error');
  span.style.whiteSpace = 'pre';
  span.textContent = object.description!;
  return span;
}

function renderStaleRemoteObject(object: Protocol.Runtime.RemoteObject, charBudget: number, prefix?: Element) {
  const span = document.createElement('span');
  const summary = renderRemoteObjectSummary(object, charBudget);
  if (prefix)
    span.append(prefix);
  for (const node of [...summary.childNodes])
    span.append(node);
  return span;
}

export function renderRemoteObjectOneLine(object: Protocol.Runtime.RemoteObject, charBudget: number) {
  if (object.objectId) {
    const objLine = renderStaleRemoteObject(object, charBudget);
    objLine.classList.add('add-left-padding');
    return objLine;
  }
  // TODO fix types here
  return renderRemoteObject(object, undefined!, undefined!, charBudget);
}

function renderObjectRemoteObject(
  object: Protocol.Runtime.RemoteObject,
  connection: JSConnection,
  willResize: JoelEvent<void>,
  charBudget: number,
  prefix?: Element,
  open = false) {
  if (!object.objectId)
    return renderStaleRemoteObject(object, charBudget, prefix);
  const innerCharBudget = charBudget - 4;
  const details = document.createElement('details');
  const summary = renderRemoteObjectSummary(object, charBudget, prefix);
  const openSummary = makeOpenSummary();
  details.appendChild(summary);
  const content = document.createElement('div');
  content.classList.add('content');
  let populated = false;
  function makeOpenSummary() {
    if (object.type !== 'object')
      return summary;
    return renderRemoteObjectSummary(object, charBudget, prefix?.cloneNode(true), true);
  }
  async function populate() {
    if (populated)
      return;
    populated = true;
    const done = startAyncWork('populate js object');
    const {result, exceptionDetails, internalProperties, privateProperties} = await connection.send('Runtime.getProperties', {
      objectId: object.objectId!,
      generatePreview: true,
      ownProperties: true,
    });
    done();
    if (details.open)
      willResize.dispatch();
    for (const property of result)
      addProperty(property);
    for (const property of privateProperties || [])
      addProperty({configurable: false, enumerable: false, ...property}, true);
    for (const property of internalProperties || [])
      addProperty({configurable: false, enumerable: false, ...property}, true);
    if (object.type === 'object')
      content.append(object.subtype === 'array' ? ']' : '}');
    function addProperty(property: Protocol.Runtime.PropertyDescriptor, dim = false) {
      const propertyLabel = document.createElement('span');
      const propertyName = document.createElement('span');
      propertyName.classList.add('property-name');
      if (dim)
        propertyName.classList.add('dim');
      if (property.symbol)
        propertyName.classList.add('symbol');
      propertyName.append(property.name);
      propertyLabel.append(propertyName, ': ');
      if (property.value && property.value.objectId) {
        content.appendChild(renderObjectRemoteObject(property.value, connection, willResize, innerCharBudget, propertyLabel));
      } else {
        const div = document.createElement('div');
        div.classList.add('property');
        div.appendChild(propertyLabel);
        if (property.value) {
          div.appendChild(renderRemoteObject(property.value, connection, willResize, innerCharBudget));
        } else {
          const types: string[] = [];
          if (property.get)
            types.push('Getter');
          if (property.set)
            types.push('Setter');
          div.appendChild(renderOther(types.join('/')));
        }
        content.appendChild(div);
      }
    }
  }
  details.addEventListener('toggle', () => {
    willResize.dispatch();
    if (details.open) {
      populate();
      details.replaceChild(openSummary, summary);
      details.appendChild(content);
    } else {
      details.replaceChild(summary, openSummary);
      details.removeChild(content);
    }      
  }, false);
  if (object.preview?.overflow)
    details.open = open;
  return details;
}

function renderRemoteObjectSummary(object: Protocol.Runtime.RemoteObject, charBudget: number, prefix?: Node, open = false) {
  const summary = document.createElement('summary');
  if (prefix)
    summary.appendChild(prefix);
  if (object.preview) {
    charBudget -= 4; // end amount
    if (object.preview.subtype !== 'array' && object.className !== 'Object')
      summary.append(object.className!, ' ');
    summary.append(object.preview.subtype === 'array' ? '[ ' : '{ ');
    if (open)
      return summary;
    charBudget -= summary.textContent!.length;
    let first = true;
    let overflow = object.preview.overflow
    for (const property of object.preview.properties) {
      const fragment = document.createDocumentFragment();
      if (!first) fragment.append(', ');
      if (object.preview.subtype !== 'array' || String(parseInt(property.name)) !== property.name) {
        fragment.append(property.name);
        fragment.append(': ');
      }
      switch (property.type) {
        case 'number':
        case 'bigint':
        case 'symbol':
        case 'undefined':
        case 'boolean':
          fragment.append(renderBasicRemoteObject(property));
          break;
        case 'string':
          fragment.append(renderStringRemoteObject(property));
          break;
        case 'function':
          fragment.append(renderOther('Function'));
          break;
        case 'object':
          if (property.subtype === 'null')
            fragment.append(renderBasicRemoteObject(property));
          else
            fragment.append(renderOther(property.value!));
          break;
        case 'accessor':
          fragment.append(renderOther('Getter'));
          break;
      }
      charBudget -= fragment.textContent!.length;
      if (charBudget < 0) {
        overflow = true;
        break;
      }
      first = false;
      summary.append(fragment);
    }
    if (overflow) {
      if (!first)
        summary.append(', ');
      summary.append('…');
    }
    summary.append(object.preview.subtype === 'array' ? ' ]' : ' }');
  } else {
    if (object.type === 'function') {
      summary.append(renderFunctionSummary(object))
    } else {
      summary.append(renderOther(object.description!));
    }
  }
  return summary;
}

function renderFunctionSummary(object: Protocol.Runtime.RemoteObject) {
  const functionName = /^function\s*(.*)\(/.exec(object.description!);
  if (functionName && functionName[1])
    return renderOther(`Function: ${functionName[1]}`);
  return renderOther('Function');

}

function renderOther(value: string) {
  const span = document.createElement('span');
  span.classList.add('remote-object', 'other');
  span.textContent = `[${value}]`;
  return span;
}

function renderBasicRemoteObject(object: Protocol.Runtime.RemoteObject|Protocol.Runtime.PropertyPreview) {
  const span = document.createElement('span');
  span.classList.add('remote-object', object.subtype === 'null' ? 'null' : object.type);
  if ('description' in object)
    span.textContent = object.description!;
  else if ('value' in object)
    span.textContent = object.value;
  else
    span.textContent = object.subtype || object.type;
  return span;
}

function renderStringRemoteObject(object: Protocol.Runtime.RemoteObject|Protocol.Runtime.PropertyPreview) {
  const span = document.createElement('span');
  span.classList.add('remote-object', 'string');
  const value: string = object.value;
  let stringified = JSON.stringify(value);
  if (!value.includes('\''))
    stringified = `'${stringified.slice(1, stringified.length - 1)}'`;
  span.textContent = stringified;
  return span;
}