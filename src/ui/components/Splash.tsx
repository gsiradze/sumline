import { useEffect, useState } from 'react';
import { Wordmark } from './Wordmark';

interface SplashProps {
  readonly durationMs?: number;
  readonly onDone?: () => void;
}

// A 6-dot ink-row that resolves into a tidy pattern mirroring the mark mechanic.
const ROW_PATTERN = [0, 1, 1, 0, 1, 0];

export function Splash({ durationMs = 1400, onDone }: SplashProps) {
  const [stage, setStage] = useState(0); // 0: start, 1: cells in, 2: wordmark in, 3: fading out

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 120);
    const t2 = setTimeout(() => setStage(2), 620);
    const t3 = setTimeout(() => setStage(3), Math.max(900, durationMs - 260));
    const t4 = setTimeout(() => onDone?.(), durationMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [durationMs, onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-paper-100 flex flex-col items-center justify-center gap-8 transition-opacity duration-300 ${
        stage === 3 ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden={stage === 3}
    >
      <div className="flex gap-[7px]">
        {ROW_PATTERN.map((v, i) => (
          <div
            key={i}
            className={`w-[26px] h-[26px] rounded-[4px] border border-rule-200 transition-all duration-[480ms] ease-out`}
            style={{
              background: v && stage >= 1 ? 'var(--ink-fill-800)' : 'var(--paper-50)',
              boxShadow:
                v && stage >= 1 ? 'inset 0 1px 2px rgba(20,24,40,0.35)' : 'none',
              transitionDelay: `${i * 55}ms`,
              transform: stage === 0 ? 'scale(0.8)' : 'scale(1)',
              opacity: stage === 0 ? 0 : 1,
            }}
          />
        ))}
      </div>
      <div
        className="transition-all duration-[420ms] ease-out"
        style={{
          opacity: stage >= 2 ? 1 : 0,
          transform: stage >= 2 ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        <Wordmark size={52} />
      </div>
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-500 transition-opacity duration-[420ms] ease-out"
        style={{ opacity: stage >= 2 ? 1 : 0 }}
      >
        Daily deduction
      </div>
      <div
        className="absolute bottom-16 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-400"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        v 0.1
      </div>
    </div>
  );
}
