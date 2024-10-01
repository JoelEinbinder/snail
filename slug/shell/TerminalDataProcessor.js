const ParserState = {
  GROUND: 0,
  ESCAPE: 1,
  ESCAPE_INTERMEDIATE: 2,
  CSI_ENTRY: 3,
  CSI_PARAM: 4,
  CSI_INTERMEDIATE: 5,
  CSI_IGNORE: 6,
  SOS_PM_APC_STRING: 7,
  OSC_STRING: 8,
  DCS_ENTRY: 9,
  DCS_PARAM: 10,
  DCS_IGNORE: 11,
  DCS_INTERMEDIATE: 12,
  DCS_PASSTHROUGH: 13,
  HTML_BLOCK: 14,
};
/**
 * @typedef {Object} TerminalDataProcessorDelegate
 * @property {function(number,string):void} htmlTerminalMessage
 * @property {function(Uint8Array):void} plainTerminalData 
 */

class TerminalDataProcessor {
  /** @private */
  state = ParserState.GROUND;
  /**
   * @private
   * @type {DataView[]}
   */
  html = [];
  /**
   * @param {TerminalDataProcessorDelegate} delegate
   */
  constructor(delegate) {
    /** @private */
    this.delegate = delegate;
  }
  /**
   * @param {string|Uint8Array} data
   */
  processRawData(data) {
    const bufferData = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    let start = 0;
    let end = 0;
    /** @type {Uint8Array[]} */
    let queuedChunks = [];

    const pushHtmlChunk = () => {
      if (start === end)
        return;
      this.html.push(new DataView(bufferData.buffer, start + bufferData.byteOffset, end - start));
      start = end;
    };
    const pushChunk = () => {
      if (start === end)
        return;
      queuedChunks.push(bufferData.slice(start, end));
      start = end;
    };

    for (let i = 0; i < bufferData.length; i++) {
      const char = bufferData[i];
      if (this.state === ParserState.GROUND) {
        if (char === 0x1b) {
          this.state = ParserState.ESCAPE;
          pushChunk();
        } else {
          end = i + 1;
        }
      } else if (this.state === ParserState.ESCAPE) {
        if (char === 0x1a) {
          pushChunk();
          for (const chunk of queuedChunks)
            this.delegate.plainTerminalData(chunk);
          queuedChunks = [];
          this.state = ParserState.HTML_BLOCK;
          start = i + 1;
          end = i + 1;
        } else {
          this.state = ParserState.GROUND;
          end = i;
          if (i === 0) {
            // TODO push the missing escape char here from last buffer
            // in practice doesn't affect anything but its good to be correct
            queuedChunks.push(new Uint8Array([0x1b]));
          }
        }
      } else if (this.state === ParserState.HTML_BLOCK) {
        if (char === 0x00) {
          pushHtmlChunk();
          if (this.html.length === 1) {
            const message = this.html[0];
            const first = message.getUint8(0);
            const view = new DataView(message.buffer, message.byteOffset + 1, message.byteLength - 1);
            this.delegate.htmlTerminalMessage(first, new TextDecoder().decode(view));
          } else {
            const arrayBuffer = new Uint8Array(this.html.reduce((acc, curr) => acc + curr.byteLength, 0));
            let offset = 0;
            for (const chunk of this.html) {
              arrayBuffer.set(new Uint8Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)), offset);
              offset += chunk.byteLength;
            }
            const first = arrayBuffer[0];
            const view = new DataView(arrayBuffer.buffer, arrayBuffer.byteOffset + 1, arrayBuffer.byteLength - 1);
            this.delegate.htmlTerminalMessage(first, new TextDecoder().decode(view));
          }
          this.html = [];
          this.state = ParserState.GROUND;
          start = i + 1;
          end = i + 1;
        } else {
          end = i + 1;
        }
      }
    }
    if (this.state === ParserState.GROUND)
      pushChunk();
    else if (this.state === ParserState.HTML_BLOCK)
      pushHtmlChunk();
    for (const chunk of queuedChunks)
      this.delegate.plainTerminalData(chunk);
  }
}

module.exports = { TerminalDataProcessor };