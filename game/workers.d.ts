declare module 'worker-loader!*' {
  const makeWorker : () => Worker;
  export default makeWorker;
}
declare module "*.png" {
  const value: string;
  export default value;
}
declare module "*.mp3" {
  const value: string;
  export default value;
}