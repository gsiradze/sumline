import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isoDateLocal } from '../game/domain/stats';
import type { Stats } from '../game/domain/stats';

const DAILY_ID_BASE = 4100;
const DAILY_DAYS = 5;
const STREAK_ID = 4199;
const STREAK_MIN = 3;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  } catch {
    return false;
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id })),
      });
    }
  } catch {
    // non-fatal
  }
}

export async function scheduleReminders(stats: Stats, enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await cancelAllReminders();
  if (!enabled) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;

    const now = new Date();
    const notifications = [];

    for (let d = 1; d <= DAILY_DAYS; d++) {
      const at = new Date(now);
      at.setDate(at.getDate() + d);
      at.setHours(10, 0, 0, 0);
      notifications.push({
        id: DAILY_ID_BASE + d,
        title: 'Sumline',
        body: 'A fresh set of deductions is waiting 🧩',
        schedule: { at },
      });
    }

    const playedToday = stats.lastActiveIsoDate === isoDateLocal(now);
    if (stats.dayStreak >= STREAK_MIN && !playedToday) {
      const at = new Date(now);
      at.setHours(19, 0, 0, 0);
      if (at.getTime() > now.getTime()) {
        notifications.push({
          id: STREAK_ID,
          title: `Keep your ${stats.dayStreak}-day streak`,
          body: 'Solve a level today so your streak stays alive.',
          schedule: { at },
        });
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch {
    // non-fatal
  }
}
