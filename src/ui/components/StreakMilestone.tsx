import { FlameIcon } from './icons';

interface StreakMilestoneProps {
  readonly days: number;
  readonly badgeName: string;
  readonly nextMilestone?: number | null;
  readonly onDismiss: () => void;
}

export function StreakMilestone({
  days,
  badgeName,
  nextMilestone,
  onDismiss,
}: StreakMilestoneProps) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={`${days}-day streak reached. Tap to continue.`}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-center px-8 focus-visible:outline-none"
      style={{
        background:
          'radial-gradient(ellipse at top, var(--ochre-100) 0%, var(--paper-100) 55%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        className="w-[120px] h-[120px] rounded-[28px] flex items-center justify-center"
        style={{
          background:
            'radial-gradient(circle at 50% 55%, var(--ochre-300) 0%, var(--ochre-100) 60%, transparent 80%)',
        }}
      >
        <FlameIcon className="w-[72px] h-[72px] text-ochre-700" />
      </div>

      <div className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-ochre-700">
        {days}-day streak
      </div>
      <div className="mt-2 font-serif text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink-900">
        {titleFor(days)}
      </div>
      <p className="mt-2 font-sans text-[14px] leading-[1.5] text-ink-500 max-w-[280px]">
        New badge unlocked — <span className="text-ink-900 font-medium">{badgeName}</span>.
        {nextMilestone !== null && nextMilestone !== undefined && ` Keep going for the ${nextMilestone}-day mark.`}
      </p>

      <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-paper-50 border border-ochre-500">
        <FlameIcon className="w-3.5 h-3.5 text-ochre-700" />
        <span className="font-serif text-[13px] font-medium text-ink-900">
          {badgeName} · day {days}
        </span>
      </div>

      <div
        className="absolute left-0 right-0 bottom-7 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-400"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        tap anywhere to continue
      </div>
    </button>
  );
}

function titleFor(days: number): string {
  if (days === 3) return 'Three days running.';
  if (days === 7) return 'One full week.';
  if (days === 14) return 'Two weeks in a row.';
  if (days === 30) return 'A month strong.';
  if (days === 60) return 'Sixty days.';
  if (days === 100) return 'A hundred.';
  return `${days} days.`;
}
