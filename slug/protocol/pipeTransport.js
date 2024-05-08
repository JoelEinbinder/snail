/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @typedef {Object} ProtocolRequest
 * @property {number=} id
 * @property {string} method
 * @property {any=} params
 */
/**
 * @typedef {Object} ProtocolResponse
 * @property {number} id
 * @property {any=} result
 * @property {any=} error
 */
class PipeTransport {
  /**
   * @param {import('stream').Writable} pipeWrite
   * @param {import('stream').Readable} pipeRead
   */
  constructor(pipeWrite, pipeRead) {
    this._pipeWrite = pipeWrite;
    this._pendingMessage = '';
    this._waitForNextTask = setImmediate;
    this._closed = false;
    pipeRead.on('data', buffer => this._dispatch(buffer));
    pipeRead.on('close', () => {
      this._closed = true;
      if (this.onclose)
        this.onclose.call(null);
    });
    pipeRead.on('error', e => console.error('error', e));
    // @ts-ignore
    if (pipeRead !== pipeWrite)
      pipeWrite.on('error', e => console.error('error', e));
    /** @type {(message: ProtocolResponse|ProtocolRequest) => void=} */
    this.onmessage = undefined;
    /** @type {() => void} */
    this.onclose = undefined;
  }

  /**
   * @param {ProtocolResponse|ProtocolRequest} message
   */
  send(message) {
    this.sendString(JSON.stringify(message));
  }

  /**
   * @param {string} messageStr
   */
  sendString(messageStr) {
    if (this._closed)
      throw new Error('Pipe has been closed');
    this._pipeWrite.write(messageStr + '\0', err => {
      if (err) {
        console.error('pipe write error', err);
        console.error('trying to write', messageStr);
      }
    });
  }

  /**
   * @param {Buffer} buffer
   */
  _dispatch(buffer) {
    let end = buffer.indexOf('\0');
    if (end === -1) {
      this._pendingMessage += buffer.toString();
      return;
    }
    const message = this._pendingMessage + buffer.toString(undefined, 0, end);
    this._waitForNextTask(() => {
      try {
      if (this.onmessage)
        this.onmessage.call(null, JSON.parse(message));
      } catch(e) {
        console.error(message.slice(0, 10), e);
      }
    });

    let start = end + 1;
    end = buffer.indexOf('\0', start);
    while (end !== -1) {
      const message = buffer.toString(undefined, start, end);
      this._waitForNextTask(() => {
        if (this.onmessage)
          this.onmessage.call(null, JSON.parse(message));
      });
      start = end + 1;
      end = buffer.indexOf('\0', start);
    }
    this._pendingMessage = buffer.toString(undefined, start);
  }
}

module.exports = {PipeTransport};