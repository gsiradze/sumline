import { useEffect, useState } from 'react';
import type { Stats } from '../../game/domain/stats';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from '../../storage/persistence';
import { isNative } from '../../platform/native';
import { showPrivacyOptions } from '../../platform/consent';
import {
  requestNotificationPermission,
  scheduleReminders,
} from '../../platform/notifications';
import { settingChanged } from '../../telemetry/events';
import { CloseIcon } from './icons';

const APP_VERSION = '0.1.0';

interface SettingsModalProps {
  readonly muted: boolean;
  readonly onToggleMute: () => void;
  readonly stats: Stats;
  readonly onDismiss: () => void;
}

function Toggle({ on }: { readonly on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-[26px] w-[44px] items-center rounded-full transition-colors duration-nudge ${
        on ? 'bg-sage-500' : 'bg-rule-300'
      }`}
    >
      <span
        className={`inline-block h-[20px] w-[20px] rounded-full bg-paper-50 shadow-sh-1 transition-transform duration-nudge ${
          on ? 'translate-x-[21px]' : 'translate-x-[3px]'
        }`}
      />
    </span>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  disabled,
  onToggle,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly on: boolean;
  readonly disabled?: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-paper-200/50 transition-colors disabled:opacity-50"
    >
      <span>
        <span className="block font-sans text-[15px] text-ink-900">{label}</span>
        {hint && <span className="block font-sans text-[12px] text-ink-500 mt-0.5">{hint}</span>}
      </span>
      <Toggle on={on} />
    </button>
  );
}

export function SettingsModal({ muted, onToggleMute, stats, onDismiss }: SettingsModalProps) {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getNotificationsEnabled().then(v => {
      if (!cancelled) setNotifEnabled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleSound = (): void => {
    onToggleMute();
  };

  const handleToggleNotifications = async (): Promise<void> => {
    if (notifBusy) return;
    setNotifBusy(true);
    try {
      if (!notifEnabled) {
        const granted = await requestNotificationPermission();
        if (!granted && isNative()) return;
        await setNotificationsEnabled(true);
        setNotifEnabled(true);
        settingChanged('notifications', true);
        await scheduleReminders(stats, true);
      } else {
        await setNotificationsEnabled(false);
        setNotifEnabled(false);
        settingChanged('notifications', false);
        await scheduleReminders(stats, false);
      }
    } finally {
      setNotifBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-paper-100 flex flex-col overflow-y-auto"
      role="dialog"
      aria-label="Settings"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--banner-height, 0px))',
      }}
    >
      <header className="px-4 pt-[18px] pb-2.5 flex items-center justify-between">
        <div className="w-9" />
        <h2 className="font-serif text-[20px] font-medium text-ink-900">Settings</h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close settings"
          className="w-9 h-9 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="mt-2 mx-4 rounded-[16px] border border-rule-200 bg-paper-50 overflow-hidden divide-y divide-rule-200">
        <ToggleRow label="Sound" on={!muted} onToggle={handleToggleSound} />
        <ToggleRow
          label="Reminders"
          hint="A gentle nudge to keep your streak alive"
          on={notifEnabled}
          disabled={notifBusy}
          onToggle={() => void handleToggleNotifications()}
        />
      </div>

      {isNative() && (
        <div className="mt-4 mx-4 rounded-[16px] border border-rule-200 bg-paper-50 overflow-hidden">
          <button
            type="button"
            onClick={() => void showPrivacyOptions()}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-paper-200/50 transition-colors"
          >
            <span className="font-sans text-[15px] text-ink-900">Privacy &amp; ad choices</span>
            <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-500">Open</span>
          </button>
        </div>
      )}

      <div className="mt-auto px-4 py-6 text-center font-mono text-[11px] tracking-[0.12em] uppercase text-ink-400">
        Sumline · v{APP_VERSION}
      </div>
    </div>
  );
}
