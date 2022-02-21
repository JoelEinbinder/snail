import { JoelEvent } from "./JoelEvent";
import { JSConnection } from "./JSConnection";
import type { LogItem } from "./LogView";
import { Protocol } from "./protocol";
import './remoteObject.css';

export class JSBlock implements LogItem {
  willResizeEvent = new JoelEvent(undefined);
  private _element: HTMLElement;
  constructor(object: Protocol.Runtime.RemoteObject, private _connection: JSConnection) {
    this._element = renderRemoteObject(object, this._connection, this.willResizeEvent);
  }
  render(): Element {
    return this._element;
  }
  focus(): void {
  }
  dispose(): void {
  }  
}

function renderRemoteObject(object: Protocol.Runtime.RemoteObject, connection: JSConnection, willResize: JoelEvent<void>): HTMLElement {
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
      return renderObjectRemoteObject(object, connection, willResize);
    // case 'function':
    default:
      console.log('unknown', object);
      return document.createElement('div');
  }
}

function renderObjectRemoteObject(object: Protocol.Runtime.RemoteObject, connection: JSConnection, willResize: JoelEvent<void>) {
  const details = document.createElement('details');
  const summary = renderRemoteObjectSummary(object);
  details.appendChild(summary);
  return details;
}

function renderRemoteObjectSummary(object: Protocol.Runtime.RemoteObject) {
  const summary = document.createElement('summary');
  if (object.preview) {
    summary.append(object.preview.subtype === 'array' ? '[ ' : '{ ');
    let first = true;
    let overflow = object.preview.overflow
    for (const property of object.preview.properties) {
      if (first) first = false; else summary.append(', ');
      if (object.preview.subtype !== 'array' || String(parseInt(property.name)) !== property.name) {
        summary.append(property.name);
        summary.append(': ');
      }
      switch (property.type) {
        case 'number':
        case 'bigint':
        case 'symbol':
        case 'undefined':
        case 'boolean':
          summary.append(renderBasicRemoteObject(property));
          break;
        case 'string':
          summary.append(renderStringRemoteObject(property));
          break;
        case 'function':
          summary.append(renderOther('Function'));
          break;
        case 'object':
          if (property.subtype === 'null') {
            summary.append(renderBasicRemoteObject(property));
            break;
          }
          summary.append(renderOther(property.value));
          break;
        case 'accessor':
          summary.append(renderOther('Getter'));
          break;
      }
    }
    if (overflow) {
      summary.append(', …');
    }
    summary.append(object.preview.subtype === 'array' ? ' ]' : ' }');
  } else {
    summary.textContent = object.description;
  }
  return summary;
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
    span.textContent = object.description;
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