import type { ReactNode } from 'react';

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

/**
 * Single-choice control for 2-4 mutually exclusive options. Uses aria-pressed rather than a
 * radio group so it stays one tab stop per option without needing arrow-key handling.
 */
export default function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
