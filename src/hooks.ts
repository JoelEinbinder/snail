import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { JoelEvent } from './JoelEvent';

export function useEvent<T>(event: JoelEvent<T>): T;
export function useEvent<T>(event?: JoelEvent<T>): T|undefined;
export function useEvent<T>(event?: JoelEvent<T>) {
  const [state, setState] = useState(() => event && event.current);
  const ref = useRef(state);
  useEffect(() => {
    if (!event)
      return;
    const listener = () => setState(event.current);
    event.on(listener);
    if (ref.current !== (event.current))
      listener();
    return () => {
      event.off(listener);
    }
  }, [event]);
  return state;
}

export function usePromise<T>(promise: Promise<T>) {
  const [state, setState] = useState<T|null>(null);
  useLayoutEffect(() => {
    promise.then(t => {
      setState(t);
    });
  }, [promise]);
  return state;
}

