import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { admobConfig } from './config/env';
import { handleBack } from './platform/back';
import { bootstrapNative, isNative, onAppForeground } from './platform/native';
import { runConsentFlow } from './platform/consent';
import { initCrash, reportError, setCrashReporter } from './telemetry/crash';
import { initAnalytics, setAnalyticsConsent, setAnalyticsProvider } from './telemetry/analytics';
import { appOpen, sessionBegin } from './telemetry/events';
import { adProvider } from './storage/ads';
import { advanceSessionOncePerBoot, getRulesShown } from './storage/persistence';
import { setSessionCount } from './storage/adSession';
// Fraunces is used only for the clue numbers on the board (digits, weight 500).
import '@fontsource/fraunces/latin-500.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('root element not found');

// The board is the only place Fraunces is used; fetch it now so the first level
// does not open with its numbers in a fallback face.
void document.fonts?.load('500 22px Fraunces').catch(() => {});

window.addEventListener('error', event => {
  reportError(event.error instanceof Error ? event.error : new Error(String(event.message)));
});
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  reportError(reason instanceof Error ? reason : new Error(String(reason)));
});
// Desktop/web equivalent of the Android back button.
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') handleBack();
});

const ADS_RETRY_MIN_GAP_MS = 30_000;
let adsStarted = false;
let adsStarting = false;
let lastAdsAttempt = 0;

// Nothing ad-related runs until the consent platform allows ad requests. When
// it does not (first launch offline, form not answered), try again later.
async function startAds(): Promise<void> {
  if (adsStarted || adsStarting) return;
  adsStarting = true;
  lastAdsAttempt = Date.now();
  try {
    const consent = await runConsentFlow();
    setAnalyticsConsent(consent.analyticsGranted);
    if (!consent.canRequestAds) return;
    adsStarted = await adProvider.init(consent.ad);
    // A first-time player meets the tutorial before any banner; the level
    // screen turns the banner on when the tutorial is dismissed.
    if (adsStarted && (await getRulesShown())) void adProvider.showBanner();
  } catch (err) {
    reportError(err instanceof Error ? err : new Error('ads start failed'));
  } finally {
    adsStarting = false;
  }
}

function refreshAds(): void {
  if (adsStarted) adProvider.onAppResume();
  else if (Date.now() - lastAdsAttempt > ADS_RETRY_MIN_GAP_MS) void startAds();
}

async function boot(): Promise<void> {
  await bootstrapNative();

  const session = await advanceSessionOncePerBoot();
  setSessionCount(session);

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
  if (isNative()) {
    const missing = admobConfig().missing;
    if (missing.length > 0) {
      reportError(new Error(`live ads requested but IDs are missing: ${missing.join(', ')}`));
    }
  }

  await startAds();
  await initAnalytics();
  appOpen();
  sessionBegin(session);

  onAppForeground(refreshAds);
  window.addEventListener('online', refreshAds);
}

void boot();

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
