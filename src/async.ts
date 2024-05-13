import { JoelEvent } from "../slug/cdp-ui/JoelEvent";

type Work = {name: string};
const workEvent = new JoelEvent<void>(undefined);

class WorkContext {
  works = new Set<Work>();
  constructor(public name: string) { }
}
const workContexts: WorkContext[] = [];
workContexts.push(new WorkContext('root'));

export function startAyncWork(name = 'Anonymous Work') {
  const work = { name };
  const { works } = workContexts[workContexts.length - 1];
  works.add(work);
  workEvent.dispatch();
  return function() {
    works.delete(work);
    workEvent.dispatch();
  }
}

export function wrapAsyncFunction<Args extends any[], ReturnVal>(name: string, fn: (...args: Args) => Promise<ReturnVal>) {
  return async function (...args: Args) {
    const done = startAyncWork(name);
    try {
      const retVal = await fn.call(this, ...args);
      done();
      return retVal;
    } catch (e) {
      done();
      throw e;
    }
  }
}
export async function waitForAnyWorkToFinish() {
  while(workContexts[workContexts.length - 1].works.size)
    await workEvent.once();
}
export function currentWaits() {
  return [...workContexts[workContexts.length - 1].works].map(w => w.name);
}

export function expectingUserInput(name = 'Anonymous Work Context') {
  const context = new WorkContext(name);
  workContexts.push(context);
  workEvent.dispatch();
  return () => {
    const index = workContexts.indexOf(context);
    if (index === -1)
      return; // good to be idempotent
    workContexts.splice(index, 1);
    workEvent.dispatch();
  };
}