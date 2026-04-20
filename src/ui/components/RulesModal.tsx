interface RulesModalProps {
  readonly onDismiss: () => void;
}

export function RulesModal({ onDismiss }: RulesModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-paper-100/95"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-label="How Grid works"
    >
      <div className="max-w-sm w-full text-left">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ochre-700">
          How Grid works
        </div>
        <h2 className="font-serif text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink-900 mt-1">
          Your marks are your queries. Each one gets a definitive answer on submit.
        </h2>
        <ul className="mt-4 space-y-2 font-sans text-[14px] leading-[1.5] text-ink-700">
          <li className="flex items-start gap-2">
            <span className="w-3 h-3 mt-1 rounded-sm bg-sage-500 shrink-0" />
            <span>
              <span className="font-semibold">Marked and correct</span> → cell locks filled (dot). You got it.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-3 h-3 mt-1 rounded-sm bg-sage-100 border border-sage-300 shrink-0 flex items-center justify-center">
              <span className="block w-2 h-0.5 bg-sage-600/60" />
            </span>
            <span>
              <span className="font-semibold">Marked and wrong</span> → cell locks empty (dash). You learned that cell is empty.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-3 h-3 mt-1 rounded-sm bg-paper-50 border border-rule-200 shrink-0" />
            <span>
              <span className="font-semibold">Unmarked</span> cells stay white. The game tells you nothing about cells you didn't ask about.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-3 h-3 mt-1 rounded-sm border border-rule-300 shrink-0" />
            <span>
              The numbers around the grid show how many cells are filled in each row and column — the clues never change.
            </span>
          </li>
        </ul>
        <p className="mt-4 font-sans text-[13px] leading-[1.5] text-ink-500 border-t border-rule-200 pt-3">
          Only cells you mark get resolved. Mark wider to learn faster (more cells per guess) or narrower to burn fewer guesses per decision — your call.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full font-sans text-[15px] font-semibold tracking-[0.02em] text-paper-100 bg-fill-800 rounded-md py-3 shadow-sh-2 active:scale-[0.98] transition-transform duration-nudge"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
