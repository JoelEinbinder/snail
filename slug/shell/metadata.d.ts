export type Task = {
  command: string;
  started: number;
  ended?: number;
};
export type Metadata = {
  task?: Task;
  connected: boolean;
  socketPath: string;
}