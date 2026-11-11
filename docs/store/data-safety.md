# Data safety / privacy answers

Reusable answers for the Play Data Safety form and iOS privacy nutrition labels
_(iOS later)_. Reflects Sumline's shipping SDKs only: **Firebase Analytics +
Crashlytics** and **AdMob** (rewarded, interstitial, banner). No IAP, no accounts,
no backend of ours.

## Data collected and shared

"Shared" means it leaves the app to a third party for their purposes; here that
is the ad network.

| Data type (Play category) | Collected | Shared | By | Purpose |
|---|---|---|---|---|
| Device or other IDs (advertising ID, app instance ID, install ID) | Yes | Yes | AdMob, Firebase | Advertising, analytics, fraud prevention |
| Approximate location (derived from IP address) | Yes | Yes | AdMob | Advertising |
| App interactions (levels, sessions, ad events) | Yes | Yes | Firebase Analytics, AdMob | Analytics, advertising |
| Crash logs | Yes | No | Crashlytics | App functionality |
| Diagnostics / other performance data | Yes | Yes | Crashlytics, AdMob | Analytics, advertising |

- No account system; no name, email, contacts, photos, precise location or purchases.
- Collection is not optional for the user (ads and analytics run by default);
  in the EEA/UK the consent form decides what is collected.
- Data is encrypted in transit. Data is not sold.
- Game progress, stats and settings stay on the device (Android's own backup may
  copy them to the user's Google account). There is nothing of ours to delete on
  request; say so in the policy and offer the support email for questions.
- Audience: 13+/general. Not directed to children; not enrolled in Play's Families program.
- Declare "uses advertising ID: yes" in the Play Console.

Check Google's current disclosure pages for AdMob and Firebase before
submitting; SDK updates change these lists.

## Required URLs
- Privacy policy: set `VITE_PRIVACY_URL` in `.env` (shown in Settings; a release
  build is refused without it) and enter the same URL in the Play listing. It
  must be live before submission and must mention the advertising ID.
- Support: set `VITE_SUPPORT_EMAIL` in `.env`; use the same address in the listing.

## iOS _(later)_
- `NSUserTrackingUsageDescription`: "Your data will be used to show you fewer, more relevant ads."
- `ITSAppUsesNonExemptEncryption = NO` (HTTPS-only exemption)
