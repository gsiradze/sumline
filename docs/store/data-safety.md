# Data safety / privacy answers

Reusable answers for the Play Data Safety form and iOS privacy nutrition labels
_(iOS later)_. Reflects Sumline's shipping SDKs only: **Firebase Analytics +
Crashlytics** and **AdMob** (rewarded, interstitial, banner). No IAP, no accounts,
no backend of ours.

## Data collected

| Data type | Collected | Purpose | Linked to identity | Used for tracking |
|---|---|---|---|---|
| Device / advertising ID | Yes | Advertising (AdMob) | No | Yes (if UMP/ATT granted) |
| Ad interactions | Yes | Advertising, analytics | No | Yes |
| Crash logs | Yes | App functionality (Crashlytics) | No | No |
| Diagnostics / performance | Yes | Analytics (Firebase) | No | No |
| App interactions (levels, sessions) | Yes | Analytics | No | No |

- No account system; no name/email/contacts/location collected.
- **No purchase history** — Sumline has no in-app purchases.
- Data is **not** sold. Personalized ads only after UMP (Android) / ATT (iOS, later) consent.
- Data encrypted in transit (HTTPS). Users can request deletion via the support email.
- Audience: 13+/general. Not directed to children; not enrolled in Play's Families program.

## Required URLs
- Privacy policy: `https://<your-domain>/privacy` (must be live before submission)
- Support: `support@<your-domain>`

## iOS _(later)_
- `NSUserTrackingUsageDescription`: "Your data will be used to show you fewer, more relevant ads."
- `ITSAppUsesNonExemptEncryption = NO` (HTTPS-only exemption)
