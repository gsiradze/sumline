import { LightbulbIcon } from './icons';

interface HintButtonProps {
  readonly onRequest: () => void;
  readonly pending: boolean;
  readonly disabled?: boolean;
}

export function HintButton({ onRequest, pending, disabled }: HintButtonProps) {
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={disabled || pending}
      className="h-11 px-4 rounded-full border border-rule-200 bg-paper-50 text-ink-700 inline-flex items-center gap-2 font-sans text-[13px] font-medium active:scale-[0.97] transition-transform duration-nudge disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fill-800/60"
      aria-label="Get a hint: watch an ad to reveal a row or column"
    >
      <LightbulbIcon className="w-3.5 h-3.5 text-ochre-700" />
      <span>{pending ? 'Loading ad…' : 'Hint'}</span>
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-[3px] bg-ochre-100 text-ochre-700">
        AD
      </span>
    </button>
  );
}
