export type MarkMode = 'mark' | 'note';

interface MarkModeToggleProps {
  readonly mode: MarkMode;
  readonly onChange: (mode: MarkMode) => void;
  readonly disabled?: boolean;
}

/**
 * Chooses what a tap on the board does: mark a cell as filled, or pencil a
 * "ruled out" dash. Holding a cell pencils a dash in either mode.
 */
export function MarkModeToggle({ mode, onChange, disabled }: MarkModeToggleProps) {
  const base =
    'h-11 px-2.5 rounded-[9px] inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold whitespace-nowrap transition-colors duration-nudge disabled:opacity-50';
  const on = 'bg-fill-800 text-paper-50 shadow-sh-1';
  const off = 'text-ink-500';
  return (
    <div
      role="radiogroup"
      aria-label="What a tap does"
      className="inline-flex shrink-0 p-[2px] rounded-[12px] bg-paper-200 border border-rule-200"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'mark'}
        disabled={disabled}
        onClick={() => onChange('mark')}
        className={`${base} ${mode === 'mark' ? on : off}`}
      >
        <span aria-hidden="true" className="w-3 h-3 rounded-[3px] bg-current" />
        Mark
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'note'}
        disabled={disabled}
        onClick={() => onChange('note')}
        className={`${base} ${mode === 'note' ? on : off}`}
      >
        <span aria-hidden="true" className="w-3 h-[3px] rounded-full bg-current" />
        Rule out
      </button>
    </div>
  );
}
