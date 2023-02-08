class ShellState {
  constructor() {
    this.storedMessages = [];
    this.cwd = process.cwd();
  }
  /**
   * @param {(message: any) => void} send
   */
  restore(send) {
    this._notifyCwdChanged(send);
    for (const message of this.storedMessages)
      send(message);
  }

  addMessage(message) {
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
    send({method: 'Shell.cwdChanged', params: {cwd: this.cwd}});
  }
}

module.exports = {ShellState};