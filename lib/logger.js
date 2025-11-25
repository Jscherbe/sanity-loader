const prefix = "Sanity Loader:";

export const log = {
  log: (...args) => console.log(prefix, ...args),
  warn: (...args) => console.warn(prefix, ...args),
  error: (...args) => console.error(prefix, ...args)
};
