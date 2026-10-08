import {
  useEffect, useId, useRef, useState,
  type KeyboardEvent, type ReactNode, type SelectHTMLAttributes,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption = { value: string | number; label: ReactNode; disabled?: boolean };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  options?: SelectOption[];
  children?: ReactNode;
  placeholder?: string;
  block?: boolean;
};

export default function Select({
  options = [], children, placeholder, block, className, value, defaultValue,
  disabled, onChange, name, id, 'aria-label': ariaLabel, ...rest
}: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const root = useRef<HTMLSpanElement>(null);
  const initial = value ?? defaultValue ?? '';
  const [internalValue, setInternalValue] = useState(String(initial));
  const [open, setOpen] = useState(false);
  const currentValue = value !== undefined ? String(value) : internalValue;
  const allOptions: SelectOption[] = placeholder !== undefined
    ? [{ value: '', label: placeholder }, ...options]
    : options;
  const selected = allOptions.find((option) => String(option.value) === currentValue);
  const enabled = allOptions.filter((option) => !option.disabled);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  function choose(next: string) {
    if (value === undefined) setInternalValue(next);
    const target = { value: next, name } as HTMLSelectElement;
    onChange?.({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const index = enabled.findIndex((option) => String(option.value) === currentValue);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((v) => !v);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = enabled[(Math.max(index, 0) + delta + enabled.length) % enabled.length];
      if (next) choose(String(next.value));
    } else if (event.key === 'Home' && enabled[0]) {
      event.preventDefault(); choose(String(enabled[0].value));
    } else if (event.key === 'End' && enabled.length) {
      event.preventDefault(); choose(String(enabled[enabled.length - 1].value));
    }
  }

  return (
    <span ref={root} className={['selectWrap', block ? 'block' : '', open ? 'open' : '', className ?? ''].filter(Boolean).join(' ')}>
      <select
        {...rest}
        id={selectId}
        name={name}
        value={currentValue}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        tabIndex={-1}
        className="selectNative"
        onFocus={() => root.current?.querySelector<HTMLButtonElement>('.selectTrigger')?.focus()}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={String(option.value)} value={option.value} disabled={option.disabled}>
            {typeof option.label === 'string' || typeof option.label === 'number' ? option.label : String(option.value)}
          </option>
        ))}
        {children}
      </select>
      <button
        type="button"
        className="selectTrigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={selectId + '-listbox'}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={!selected || currentValue === '' ? 'placeholder' : ''}>{selected?.label ?? placeholder ?? currentValue}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <span id={selectId + '-listbox'} className="selectMenu" role="listbox" aria-label={ariaLabel}>
          {allOptions.map((option) => {
            const optionValue = String(option.value);
            const active = optionValue === currentValue;
            return (
              <button
                key={optionValue || '__placeholder'}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                className="selectOption"
                onClick={() => choose(optionValue)}
              >
                <span>{option.label}</span>
                {active && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}
