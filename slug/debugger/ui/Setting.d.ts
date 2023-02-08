export interface Setting<T> {
  save(value: T): void;
  load(): Promise<T>;
}