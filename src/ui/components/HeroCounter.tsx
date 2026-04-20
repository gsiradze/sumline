interface HeroCounterProps {
  readonly marked: number;
  readonly target: number;
}

export function HeroCounter({ marked, target }: HeroCounterProps) {
  const matched = marked === target;
  const numberClass = matched ? 'text-sage-700' : 'text-ink-900';
  const labelText = matched ? 'Right count. Check the rows.' : 'Filled cells known';
  const labelClass = matched ? 'text-sage-700' : 'text-ink-500';

  return (
    <div className="flex flex-col items-center pt-1 pb-2 select-none">
      <div className="flex items-baseline gap-2 font-serif font-semibold leading-none tracking-[-0.02em] transition-colors duration-fade ease-out">
        <span
          className={`text-[44px] tabular-nums transition-transform duration-flip ease-out ${numberClass} ${matched ? 'scale-[1.02]' : 'scale-100'}`}
        >
          {marked}
        </span>
        <span className="text-ink-300 text-[22px]">·</span>
        <span className="text-ink-400 text-[22px] tabular-nums">{target}</span>
      </div>
      <div
        className={`font-mono text-[10px] tracking-[0.14em] uppercase mt-1.5 transition-colors duration-fade ${labelClass}`}
      >
        {labelText}
      </div>
    </div>
  );
}
