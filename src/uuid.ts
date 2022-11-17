export const randomUUID: () => string = 'randomUUID' in crypto ? crypto['randomUUID'] : () => {
  // https://stackoverflow.com/a/2117523/2800218
  // LICENSE: https://creativecommons.org/licenses/by-sa/4.0/legalcode
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,
    c => (parseInt(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> parseInt(c) / 4).toString(16)
  );
};

