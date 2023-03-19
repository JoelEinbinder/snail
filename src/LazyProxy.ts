// A proxy that delays method calls until the object is fulfilled.
// Used when some object will be available later, but we want to
// call its methods right away.
export function makeLazyProxy<T extends object>() {
  let fulfilled: T|null = null;
  const messages: { method: string|symbol, args: any[] }[] = [];
  const proxy = new Proxy<T>({} as T, {
    get(target, method) {
      if (fulfilled)
        return fulfilled[method].bind(fulfilled);
      return (...args: any[]) => {
        messages.push({ method, args });
      };
    }
  });
  function fulfill(value: T) {
    fulfilled = value;
    for (const { method, args } of messages)
      value[method].apply(value, args);
    messages.splice(0, messages.length);
  }
  return { proxy, fulfill };
}
