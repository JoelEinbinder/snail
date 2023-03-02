declare module 'worker-loader!*' {
  const makeWorker : () => Worker;
  export default makeWorker;
}
