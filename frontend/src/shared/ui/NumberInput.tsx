import { Minus, Plus } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max' | 'step'> & {
  value: number | '';
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

/**
 * Number field with its own steppers. The native spinners are a few pixels wide, follow the OS
 * theme rather than ours, and sit on the wrong edge under RTL, so they are replaced with buttons.
 * Those buttons stay out of the tab order and the a11y tree: the input itself already steps with
 * the arrow keys, so exposing them would add two stops per field and announce nothing new.
 * Values are clamped here rather than on blur, so the field can never hold an out-of-range number.
 */
export default function NumberInput({
  value, onValueChange, min, max, step = 1, disabled, ...rest
}: Props) {
  const current = value === '' ? (min ?? 0) : value;
  const clamp = (next: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
  const atMin = min !== undefined && current <= min;
  const atMax = max !== undefined && current >= max;

  return (
    <span className="stepper">
      <button
        type="button" tabIndex={-1} aria-hidden="true"
        disabled={disabled || atMin}
        onClick={() => onValueChange(clamp(current - step))}
      >
        <Minus size={14} />
      </button>
      <input
        type="number" inputMode="numeric"
        value={value} min={min} max={max} step={step} disabled={disabled}
        onChange={(e) => onValueChange(e.target.value === '' ? (min ?? 0) : clamp(Number(e.target.value)))}
        {...rest}
      />
      <button
        type="button" tabIndex={-1} aria-hidden="true"
        disabled={disabled || atMax}
        onClick={() => onValueChange(clamp(current + step))}
      >
        <Plus size={14} />
      </button>
    </span>
  );
}
