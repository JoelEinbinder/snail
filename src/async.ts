import { JoelEvent } from "./JoelEvent";

type Work = {name: string};
const works = new Set<Work>();
const workEvent = new JoelEvent<void>(undefined);

export function startAyncWork(name = 'Anonymous Work') {
  const work = { name };
  works.add(work);
  workEvent.dispatch();
  return function() {
    works.delete(work);
    workEvent.dispatch();
  }
}
export async function waitForAnyWorkToFinish() {
  while(works.size)
    await workEvent.once();
}
export function currentWaits() {
  return [...works].map(w => w.name);
}