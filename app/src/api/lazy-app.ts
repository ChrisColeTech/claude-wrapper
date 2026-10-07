import { Express } from 'express';

/**
 * An Express app that is built on first use: the first call, property read or write
 * runs `build` once, and everything after goes to the built app. This keeps the server
 * module's default export an app without building one at module load.
 */
export function lazyApp(build: () => Express): Express {
  let built: Express | undefined;
  const app = (): Express => (built ??= build());

  const placeholder = (() => undefined) as unknown as Express;
  return new Proxy(placeholder, {
    apply: (_target, thisArg, args) => Reflect.apply(app(), thisArg, args),
    get: (_target, property) => Reflect.get(app(), property),
    set: (_target, property, value) => Reflect.set(app(), property, value),
    has: (_target, property) => Reflect.has(app(), property)
  });
}
