export class TaskQueue {
    private _promise = Promise.resolve();
    queue(task: () => (void|Promise<void>)) {
        this._promise = this._promise.then(() => task());
        return this._promise;
    }
}
