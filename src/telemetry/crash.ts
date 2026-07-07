export interface CrashContext {
  readonly [key: string]: unknown;
}

export type CrashReporter = {
  readonly init: () => Promise<void>;
  readonly reportError: (error: Error, context?: CrashContext) => void;
  readonly setUser: (id: string | null) => void;
  readonly log: (message: string) => void;
};

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

function devLog(...args: unknown[]): void {
  if (!isDev) return;
  console.warn('[crash]', ...args);
}

const noopReporter: CrashReporter = {
  async init() {
    devLog('init (noop)');
  },
  reportError(error, context) {
    devLog('error', error.message, context ?? {});
  },
  setUser(id) {
    devLog('setUser', id);
  },
  log(message) {
    devLog(message);
  },
};

let reporter: CrashReporter = noopReporter;

export function setCrashReporter(next: CrashReporter): void {
  reporter = next;
}

export async function initCrash(): Promise<void> {
  await reporter.init();
}

export function reportError(error: Error, context?: CrashContext): void {
  reporter.reportError(error, context);
}

export function setCrashUser(id: string | null): void {
  reporter.setUser(id);
}

export function crashLog(message: string): void {
  reporter.log(message);
}
