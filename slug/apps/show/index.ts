///<reference path="../../iframe/types.d.ts" />
import { JoelEvent } from '../../cdp-ui/JoelEvent';
import { renderExcalidraw } from './excalidraw';
import './index.css';
window.onresize = updateSize;
function updateSize() {
  snail.setHeight(document.body.offsetHeight);
}

let antiCache = 0;
while (true) {
  const message = await snail.waitForMessage<{filePath: string, mimeType: string}>();
  document.body.textContent = '';
  const {filePath, mimeType} = message;
  if (filePath.endsWith('.excalidraw')) {
    await renderExcalidraw(filePath + '?' + antiCache++);
    document.body.addEventListener('wheel', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
        return;
      event.stopImmediatePropagation();
    }, true);
    updateSize();
  } else if (!mimeType) {
    document.body.textContent = `Cannot show ${filePath}. Unknown mime type.`;
    updateSize();
  } else if (mimeType.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = filePath + '?' + antiCache++;
    if (mimeType === 'image/svg+xml')
      image.style.height = '150px';
    image.onload = () => {
      updateSize();
    };
    document.body.append(image);
  } else if (mimeType.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = filePath + '?' + antiCache++;
    document.body.append(video);
    video.oncanplay = () => {
      updateSize();
    }
    updateSize();
  } else if (mimeType.startsWith('application/json')) {
    type JSONObject = {}|number|string|boolean|null;
    function renderJSON(object: JSONObject, willResize: JoelEvent<void>, charBudget: number, open = false): HTMLElement {
      switch (typeof object) {
        case 'number':
        case 'boolean':
          return renderBasicRemoteObject(object);
        case 'string':
          return renderStringRemoteObject(object);
        case 'object':
          if (object === null)
            return renderBasicRemoteObject(object);
          return renderObjectJSON(object, willResize, charBudget, undefined, open);
        default:
          console.error('unknown', object);
          return document.createElement('div');
      }
    }

    function renderObjectJSON(
      object: JSONObject,
      willResize: JoelEvent<void>,
      charBudget: number,
      prefix?: Element,
      open = false) {
      const innerCharBudget = charBudget - 4;
      const details = document.createElement('details');
      const summary = renderRemoteObjectSummary(object, charBudget, prefix);
      const openSummary = makeOpenSummary();
      details.appendChild(summary);
      const content = document.createElement('div');
      content.classList.add('content');
      let populated = false;
      function makeOpenSummary() {
        if (typeof object !== 'object')
          return summary;
        return renderRemoteObjectSummary(object, charBudget, prefix?.cloneNode(true), true);
      }
      async function populate() {
        if (populated)
          return;
        populated = true;
        if (details.open)
          willResize.dispatch();
        
        for (const [name, value] of Object.entries(object as { [key: string]: JSONObject }))
          addProperty({name, value});
        if (typeof object === 'object')
          content.append(Array.isArray(object) ? ']' : '}');
        function addProperty(property: { name: string, value: JSONObject }) {
          const propertyLabel = document.createElement('span');
          const propertyName = document.createElement('span');
          propertyName.classList.add('property-name');
          propertyName.append(property.name);
          propertyLabel.append(propertyName, ': ');
          if (property.value && typeof property.value === 'object') {
            content.appendChild(renderObjectJSON(property.value as JSONObject, willResize, innerCharBudget, propertyLabel));
          } else {
            const div = document.createElement('div');
            div.classList.add('property');
            div.appendChild(propertyLabel);
            div.appendChild(renderJSON(property.value, willResize, innerCharBudget));
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
      if (open)
        details.open = true;
      return details;
    }

    function renderRemoteObjectSummary(object: JSONObject, charBudget: number, prefix?: Node, open = false) {
      const summary = document.createElement('summary');
      if (prefix)
        summary.appendChild(prefix);
        charBudget -= 4; // end amount
        summary.append(Array.isArray(object) ? '[ ' : '{ ');
        if (open)
          return summary;
        charBudget -= summary.textContent!.length;
        let first = true;
        let overflow = false;
        for (const [name, value] of Object.entries(object!)) {
          const fragment = document.createDocumentFragment();
          if (!first) fragment.append(', ');
          if (!Array.isArray(object) || String(parseInt(name)) !== name) {
            fragment.append(name);
            fragment.append(': ');
          }
          switch (typeof value) {
            case 'number':
            case 'boolean':
              fragment.append(renderBasicRemoteObject(value));
              break;
            case 'string':
              fragment.append(renderStringRemoteObject(value));
              break;
            case 'object':
              if (value === null)
                fragment.append(renderBasicRemoteObject(value));
              else if (Object.entries(value).length === 0)
                fragment.append(Array.isArray(object) ? '[]' : '{}');
              else
                fragment.append(Array.isArray(object) ? '[…]' : '{…}');
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
        summary.append(Array.isArray(object) ? ' ]' : ' }');
      return summary;
    }

    function renderBasicRemoteObject(object: number|boolean|null) {
      const span = document.createElement('span');
      span.classList.add('json', object === null ? 'null' : typeof object);
      span.textContent = String(object);
      return span;
    }

    function renderStringRemoteObject(value: string) {
      const span = document.createElement('span');
      span.classList.add('json', 'string');
      let stringified = JSON.stringify(value);
      if (!value.includes('\''))
        stringified = `'${stringified.slice(1, stringified.length - 1)}'`;
      span.textContent = stringified;
      return span;
    }
    const willResizeEvent = new JoelEvent<void>(undefined);
    willResizeEvent.on(() => {
      setTimeout(updateSize, 0);
    });
    const json = await fetch(filePath).then(response => response.json());
    document.body.append(renderJSON(json, willResizeEvent, 100, true));
    updateSize();
  }
}
