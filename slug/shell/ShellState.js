const { TerminalDataProcessor } = require('./TerminalDataProcessor');
const { ChartState } = require('./ChartState');
class ShellState {
  constructor() {
    /** @type {{method: string, params: any}[]} */
    this.storedMessages = [];
    this.cwd = process.cwd();
    /**
     * @private
     * @type {Map<number, TerminalDataProcessor>}
     */
    this.terminalProcessors = new Map();
  }
  /**
   * @param {(message: any) => void} send
   */
  restore(send) {
    this._notifyCwdChanged(send);
    for (const message of this.storedMessages)
      send(message);
  }

  _processNotify(method, params) {
    if (method === 'startTerminal') {
      const {id, previewToken} = params;
      let datas = [];
      let addedMessage = false;
      const addIfNeeded = () => {
        if (addedMessage)
          return;
        this.storedMessages.push({
          method: 'Shell.notify',
          params: {
            payload: {
              method: 'data',
              params: {
                id,
                previewToken,
                get data() {
                  const builtDatas = [...datas];
                  // TODO put the progress bar in the right place
                  if (lastProgress) {
                    builtDatas.push(new Uint8Array([0x1b, 0x1a, 78]));
                    builtDatas.push(lastProgress);
                    builtDatas.push(new Uint8Array([0x0]));
                  }
                  // TODO put the chart in the right place
                  if (chartState.data.length) {
                    builtDatas.push(new Uint8Array([0x1b, 0x1a, 67]));
                    builtDatas.push(new TextEncoder().encode(JSON.stringify(chartState.data)));
                    builtDatas.push(new Uint8Array([0x0]));
                  }
                  return Buffer.concat(builtDatas).toString('utf-8')
                }
              }
            }
          }
        })
        addedMessage = true;
      };
      /** @type {Uint8Array|null} */
      let lastProgress = null;
      const chartState = new ChartState();
      this.terminalProcessors.set(params.id, new TerminalDataProcessor({
        htmlTerminalMessage: (data) => {
          addIfNeeded();
          switch(data[0]) {
            case 67: {
              // chart data
              const dataStr = new TextDecoder().decode(data.slice(1));
              try {
                const chartData = JSON.parse(dataStr);
                if (Array.isArray(chartData))
                  chartData.forEach(data => chartState.appendData(data));
                else
                  chartState.appendData(chartData);
              } catch (e) {
                require('fs').appendFileSync('./chart-error.log', `${dataStr}\n${e.stack}\n`);
                return;
              }
              return;
            }
            case 81: {
              // uncached message
              // don't store this, because the client will re-request it on reconnect
              return;
            }
            case 78: {
              // progress
              lastProgress = data.slice(1);
              return;
            }
            case 80: {
              // TODO threading stin doesn't work well with reconnects
              // need a better solution
              // save it anyway incase we are disconnected and someone will need to respond
              break;
            }
          }
          addData(new Uint8Array([0x1b, 0xa]));
          addData(data);
          addData(new Uint8Array([0x0]));
        },
        plainTerminalData: (data) => {
          addIfNeeded();
          addData(data);
        }
      }));
      function addData(data) {
        datas.push(data);
        // TODO better message compression
        if (datas.length > 10000)
          datas = datas.slice(-5000);
      }
      return false;
    } else if (method === 'endTerminal') {
      const {id, previewToken} = params;
      this.terminalProcessors.delete(id);
      return false;
    } else if (method === 'data') {
      const {id, previewToken, data} = params;
      this.terminalProcessors.get(id).processRawData(data);
      return true;
    }
    return false;
  }

  addMessage(message) {
    if (message.method === 'Shell.notify') {
      const {method, params} = message.params.payload;
      if (this._processNotify(method, params))
        return;
    }
    this.storedMessages.push(message);
    // TODO better message compression
    if (this.storedMessages.length > 10000)
      this.storedMessages = this.storedMessages.slice(-5000);
  }

  clear() {
    this.storedMessages = [];
  }

  setCwd(cwd, send) {
    this.cwd = cwd;
    this._notifyCwdChanged(send);
  }

  _notifyCwdChanged(send) {
    send({method: 'Shell.notify', params: { payload: {method: 'cwd', params: this.cwd }}});
  }
}

module.exports = {ShellState};