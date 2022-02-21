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

export class JSLogBlock implements LogItem {
  willResizeEvent = new JoelEvent(undefined);
  private _element = document.createElement('div');
  constructor(log: Protocol.Runtime.consoleAPICalledPayload, connection: JSConnection) {
    let first = true;
    for (const arg of log.args) {
      if (first)
        first = false;
      else
        this._element.append(' ');
      if (arg.type === 'string')
        this._element.append(arg.value);
      else {
        const object = renderRemoteObject(arg, connection, this.willResizeEvent);
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
      if (object.subtype === 'error')
        return renderErrorRemoteObject(object);
      return renderObjectRemoteObject(object, connection, willResize);
    case 'function':
      return renderObjectRemoteObject(object, connection, willResize);
    default:
      console.log('unknown', object);
      return document.createElement('div');
  }
}

function renderErrorRemoteObject(object: Protocol.Runtime.RemoteObject) {
  const span = document.createElement('span');
  span.classList.add('remote-object', 'error');
  span.style.whiteSpace = 'pre';
  span.textContent = object.description;
  return span;
}

function renderStaleRemoteObject(object: Protocol.Runtime.RemoteObject, prefix?: Element) {
  const span = document.createElement('span');
  const summary = renderRemoteObjectSummary(object);
  if (prefix)
    span.append(prefix);
  for (const node of summary.childNodes)
    span.append(node);
  return span;
}

function renderObjectRemoteObject(object: Protocol.Runtime.RemoteObject, connection: JSConnection, willResize: JoelEvent<void>, prefix?: Element) {
  if (!object.objectId)
    return renderStaleRemoteObject(object, prefix);
  const details = document.createElement('details');
  const summary = renderRemoteObjectSummary(object, prefix);
  details.appendChild(summary);
  const content = document.createElement('div');
  content.classList.add('content');
  let populated = false;
  async function populate() {
    if (populated)
      return;
    populated = true;
    const {result, exceptionDetails, internalProperties, privateProperties} = await connection.send('Runtime.getProperties', {
      objectId: object.objectId,
      generatePreview: true,
      ownProperties: true,
    });
    if (details.open)
      willResize.dispatch();
    for (const property of result)
      addProperty(property);
    for (const property of privateProperties || [])
      addProperty({configurable: false, enumerable: false, ...property}, true);
    for (const property of internalProperties || [])
      addProperty({configurable: false, enumerable: false, ...property}, true);
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
        content.appendChild(renderObjectRemoteObject(property.value, connection, willResize, propertyLabel));
      } else {
        const div = document.createElement('div');
        div.classList.add('property');
        div.appendChild(propertyLabel);
        if (property.value) {
          div.appendChild(renderRemoteObject(property.value, connection, willResize));
        } else {
          const types = [];
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
      details.appendChild(content);
    } else {
      details.removeChild(content);
    }      
  }, false);
  return details;
}

function renderRemoteObjectSummary(object: Protocol.Runtime.RemoteObject, prefix?: Element) {
  const summary = document.createElement('summary');
  if (prefix)
    summary.appendChild(prefix);
  if (object.preview) {
    if (object.preview.subtype !== 'array' && object.className !== 'Object')
      summary.append(object.className, ' ');
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
          if (property.subtype === 'null')
            summary.append(renderBasicRemoteObject(property));
          else
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
    if (object.type === 'function')
      summary.append(renderOther('Function'));
    else
      summary.append(renderOther(object.description));
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