# Launch-day runbook

Sumline has no backend of ours — everything is on-device plus Firebase/AdMob
managed infra. Launch week is about **observability**, not capacity.

## Alerts to arm
- Firebase Crashlytics velocity alerts: ON
- Play Console ANR watch (ANR > 0.47% hurts ranking)
- AdMob: watch match rate + eCPM daily (rewarded, interstitial, banner)

## Dashboards open day one
- Funnels: level 1→10 progression, tier unlock progression, D1/D7 retention,
  ad impressions → ARPDAU
- Crash-free users, DAU

## Triage order
1. Crash-loops (sort by device model — cheap Android first)
2. ANRs
3. Ad no-fill / jank (banner and interstitial are the most visible)
4. Funnel leaks (early levels, first tier gate)
