import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../../config/links';
import { APP_VERSION } from '../../config/version';
import type { Stats } from '../../game/domain/stats';
import { getNotificationsEnabled, setNotificationsEnabled } from '../../storage/persistence';
import { BACK_PRIORITY_OVERLAY } from '../../platform/back';
import { isNative } from '../../platform/native';
import { currentConsent, showPrivacyOptions } from '../../platform/consent';
import { requestNotificationPermission, scheduleReminders } from '../../platform/notifications';
import { settingChanged } from '../../telemetry/events';
import { useBackHandler } from '../hooks/useBackHandler';
import { ChevronRightIcon, CloseIcon } from './icons';

interface SettingsModalProps {
  readonly muted: boolean;
  readonly onToggleMute: () => void;
  readonly musicOn: boolean;
  readonly onToggleMusic: () => void;
  readonly hapticsOn: boolean;
  readonly onToggleHaptics: () => void;
  readonly darkTheme: boolean;
  readonly onToggleTheme: () => void;
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
        className={`inline-block h-[20px] w-[20px] rounded-full bg-paper-50 dark:bg-ink-900 shadow-sh-1 transition-transform duration-nudge ${
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
      className="w-full min-h-[52px] flex items-center justify-between px-4 py-3 text-left active:bg-paper-200/50 transition-colors disabled:opacity-50"
    >
      <span>
        <span className="block font-sans text-[15px] text-ink-900">{label}</span>
        {hint && <span className="block font-sans text-[12px] text-ink-500 mt-0.5">{hint}</span>}
      </span>
      <Toggle on={on} />
    </button>
  );
}

const linkRow =
  'w-full min-h-[52px] flex items-center justify-between px-4 py-3 text-left font-sans text-[15px] text-ink-900 active:bg-paper-200/50 transition-colors';

function LinkRow({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkRow}>
      <span>{children}</span>
      <ChevronRightIcon className="w-4 h-4 text-ink-400" />
    </a>
  );
}

export function SettingsModal({
  muted,
  onToggleMute,
  musicOn,
  onToggleMusic,
  hapticsOn,
  onToggleHaptics,
  darkTheme,
  onToggleTheme,
  stats,
  onDismiss,
}: SettingsModalProps) {
  useBackHandler(onDismiss, BACK_PRIORITY_OVERLAY);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getNotificationsEnabled().then(v => {
      if (!cancelled) setNotifEnabled(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleNotifications = async (): Promise<void> => {
    if (notifBusy) return;
    setNotifBusy(true);
    try {
      if (!notifEnabled) {
        const granted = await requestNotificationPermission();
        if (!granted && isNative()) {
          setNotifDenied(true);
          return;
        }
        setNotifDenied(false);
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

  // The consent platform says where a "change my choices" entry point is
  // required; elsewhere the form does not exist and the row would do nothing.
  const showPrivacyChoices = isNative() && currentConsent().privacyOptionsRequired;
  const hasLinks = showPrivacyChoices || PRIVACY_POLICY_URL !== '' || SUPPORT_EMAIL !== '';

  return (
    <div
      className="overlay-safe fixed inset-0 z-50 bg-paper-100 flex flex-col overflow-y-auto"
      role="dialog"
      aria-label="Settings"
    >
      <header className="px-4 pt-3 pb-2.5 flex items-center justify-between">
        <div className="w-11" />
        <h2 className="font-serif text-[20px] font-medium text-ink-900">Settings</h2>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close settings"
          className="w-11 h-11 rounded-md border border-rule-200 bg-paper-50 text-ink-500 hover:text-ink-900 flex items-center justify-center active:scale-95 transition-transform duration-nudge"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="mt-2 mx-4 rounded-[16px] border border-rule-200 bg-paper-50 overflow-hidden divide-y divide-rule-200">
        <ToggleRow label="Sound" on={!muted} onToggle={onToggleMute} />
        <ToggleRow
          label="Music"
          hint={muted ? 'Sound is off' : undefined}
          on={musicOn}
          disabled={muted}
          onToggle={onToggleMusic}
        />
        <ToggleRow label="Vibration" on={hapticsOn} onToggle={onToggleHaptics} />
        <ToggleRow label="Dark theme" on={darkTheme} onToggle={onToggleTheme} />
        <ToggleRow
          label="Reminders"
          hint={
            notifDenied
              ? 'Notifications are blocked. Allow them for Sumline in system settings.'
              : 'A gentle nudge to keep your streak alive'
          }
          on={notifEnabled}
          disabled={notifBusy}
          onToggle={() => void handleToggleNotifications()}
        />
      </div>

      {hasLinks && (
        <div className="mt-4 mx-4 rounded-[16px] border border-rule-200 bg-paper-50 overflow-hidden divide-y divide-rule-200">
          {PRIVACY_POLICY_URL !== '' && <LinkRow href={PRIVACY_POLICY_URL}>Privacy policy</LinkRow>}
          {showPrivacyChoices && (
            <button type="button" onClick={() => void showPrivacyOptions()} className={linkRow}>
              <span>Privacy &amp; ad choices</span>
              <ChevronRightIcon className="w-4 h-4 text-ink-400" />
            </button>
          )}
          {SUPPORT_EMAIL !== '' && (
            <LinkRow href={`mailto:${SUPPORT_EMAIL}?subject=Sumline%20${APP_VERSION}`}>
              Contact support
            </LinkRow>
          )}
        </div>
      )}

      <div className="mt-auto px-4 py-6 text-center font-mono text-[11px] tracking-[0.12em] uppercase text-ink-400">
        Sumline · v{APP_VERSION}
      </div>
    </div>
  );
}
