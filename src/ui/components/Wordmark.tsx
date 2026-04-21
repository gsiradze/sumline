interface WordmarkProps {
  readonly size?: number;
  readonly className?: string;
}

export function Wordmark({ size = 40, className }: WordmarkProps) {
  const px = (em: number): number => Math.round(size * em);
  return (
    <span
      className={`inline-flex items-baseline font-serif font-semibold text-ink-900 select-none ${
        className ?? ''
      }`}
      style={{
        fontSize: size,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        gap: Math.max(1, px(0.015)),
      }}
      aria-label="Sumline"
    >
      <span>Sum</span>
      <span className="relative inline-block">l</span>
      <span
        className="relative inline-block"
        style={{ width: `${px(0.4)}px`, height: `${size}px` }}
        aria-hidden="true"
      >
        <span
          className="absolute bg-fill-800 rounded-[2px]"
          style={{
            left: '50%',
            top: `${px(0.04)}px`,
            transform: 'translateX(-50%)',
            width: `${px(0.3)}px`,
            height: `${px(0.3)}px`,
            boxShadow: 'inset 0 1px 1px rgba(20,24,40,0.4)',
          }}
        />
        <span
          className="absolute bg-ink-900 rounded-[1px]"
          style={{
            left: '50%',
            top: `${px(0.44)}px`,
            transform: 'translateX(-50%)',
            width: `${Math.max(1, px(0.1))}px`,
            height: `${px(0.56)}px`,
          }}
        />
      </span>
      <span>ne</span>
    </span>
  );
}
