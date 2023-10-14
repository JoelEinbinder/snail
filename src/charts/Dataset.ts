import type {Data} from '../shared/protocol';
export type ProcessedData = {step: number, wallTime: number, value: number}[];
export class Dataset {
  private values = new Map<string, ProcessedData>();
  processData(data: Data) {
    for (const item of data) {
      if (!item.summary)
        continue;
      for (const v of item.summary.value) {
        if (!this.values.has(v.tag))
          this.values.set(v.tag, []);
        this.values.get(v.tag)!.push({
          step: Number(item.step), // TODO bigint technically correct here
          wallTime: item.wallTime,
          value: v.simpleValue
        });
      }
    }
  }

  tags() {
    return Array.from(this.values.keys());
  }

  get(tag: string) {
    return this.values.get(tag);
  }
}