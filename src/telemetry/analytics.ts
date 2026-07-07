export interface AnalyticsEvent {
  readonly kind: string;
  readonly [key: string]: unknown;
}

export interface AnalyticsProvider {
  readonly init: () => Promise<void>;
  readonly track: (event: AnalyticsEvent) => void;
  readonly setUser: (id: string | null) => void;
  readonly setConsent: (granted: boolean) => void;
}

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

function devLog(...args: unknown[]): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.info('[analytics]', ...args);
}

const noopProvider: AnalyticsProvider = {
  async init() {
    devLog('init (noop)');
  },
  track(event) {
    devLog(event.kind, event);
  },
  setUser(id) {
    devLog('setUser', id);
  },
  setConsent(granted) {
    devLog('setConsent', granted);
  },
};

let provider: AnalyticsProvider = noopProvider;

export function setAnalyticsProvider(next: AnalyticsProvider): void {
  provider = next;
}

export async function initAnalytics(): Promise<void> {
  await provider.init();
}

export function trackEvent(event: AnalyticsEvent): void {
  provider.track(event);
}

export function setAnalyticsUser(id: string | null): void {
  provider.setUser(id);
}

export function setAnalyticsConsent(granted: boolean): void {
  provider.setConsent(granted);
}
