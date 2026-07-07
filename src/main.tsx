import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { bootstrapNative, isNative } from './platform/native';
import { runConsentFlow } from './platform/consent';
import { initCrash, reportError, setCrashReporter } from './telemetry/crash';
import { initAnalytics, setAnalyticsConsent, setAnalyticsProvider } from './telemetry/analytics';
import { appOpen, sessionStart } from './telemetry/events';
import { adProvider } from './storage/ads';
import { advanceSessionOncePerBoot } from './storage/persistence';
import { setSessionCount } from './storage/adSession';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('root element not found');

window.addEventListener('error', event => {
  reportError(event.error instanceof Error ? event.error : new Error(String(event.message)));
});
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  reportError(reason instanceof Error ? reason : new Error(String(reason)));
});

async function boot(): Promise<void> {
  await bootstrapNative();

  if (isNative()) {
    try {
      const [{ FirebaseCrashReporter }, { FirebaseAnalyticsProvider }] = await Promise.all([
        import('./telemetry/firebaseCrash'),
        import('./telemetry/firebaseAnalytics'),
      ]);
      setCrashReporter(new FirebaseCrashReporter());
      setAnalyticsProvider(new FirebaseAnalyticsProvider());
    } catch (err) {
      reportError(err instanceof Error ? err : new Error('firebase provider load failed'));
    }
  }

  await initCrash();
  const consent = await runConsentFlow();
  await adProvider.init(consent.ad);
  void adProvider.showBanner();
  setAnalyticsConsent(consent.analyticsGranted);
  await initAnalytics();

  const session = await advanceSessionOncePerBoot();
  setSessionCount(session);
  appOpen();
  sessionStart(session);
}

void boot();

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
