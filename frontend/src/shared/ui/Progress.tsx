import type { HTMLAttributes } from 'react';

export default function Progress({ value, max = 100, label, className, ...rest }: {
  value: number;
  max?: number;
  label?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return (
    <div
      {...rest}
      className={['progress', className ?? ''].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(safeMax, Math.max(0, value))}
    >
      <span style={{ width: percent + '%' }} />
    </div>
  );
}
