import { LightbulbIcon } from './icons';

interface TeachingHintProps {
  readonly hint: string;
}

export function TeachingHint({ hint }: TeachingHintProps) {
  return (
    <div className="mx-5 mt-3 mb-2 rounded-lg border border-ochre-300 bg-ochre-100/40 px-3 py-2 flex items-start gap-2 text-ink-900">
      <LightbulbIcon className="w-4 h-4 mt-0.5 text-ochre-600 shrink-0" />
      <p className="font-sans text-[13px] leading-[1.45]">{hint}</p>
    </div>
  );
}
