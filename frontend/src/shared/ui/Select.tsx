import {
  useEffect, useId, useRef, useState,
  type ChangeEvent, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useFloating } from './floating';

export type SelectOption = { value: string | number; label: ReactNode; hint?: ReactNode; disabled?: boolean };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  options?: SelectOption[];
  children?: ReactNode;
  placeholder?: string;
  block?: boolean;
};

const textOf = (label: ReactNode) => (typeof label === 'string' || typeof label === 'number' ? String(label) : '');

/**
 * Themed listbox. A visually hidden native `<select>` keeps `name`, form submission and label
 * association working; the visible trigger and the portalled list carry the interaction.
 *
 * Keyboard: Enter / Space / Arrow keys open the list, arrows move the highlight without
 * committing, Enter commits, Escape closes, typing jumps to the first matching option, and
 * arrows on the closed trigger step the value directly (as a native select does).
 */
export default function Select({
  options = [], children, placeholder, block, className, value, defaultValue,
  disabled, onChange, name, id, 'aria-label': ariaLabel,
  'aria-describedby': describedBy, 'aria-invalid': invalid, ...rest
}: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const listId = selectId + '-listbox';
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [internalValue, setInternalValue] = useState(String(value ?? defaultValue ?? ''));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const pos = useFloating(open, trigger, menu, { matchWidth: true, offset: 4 });

  const currentValue = value !== undefined && value !== null ? String(value) : internalValue;
  const all: SelectOption[] = placeholder !== undefined ? [{ value: '', label: placeholder }, ...options] : options;
  const selectedIndex = all.findIndex((o) => String(o.value) === currentValue);
  const selected = all[selectedIndex];

  useEffect(() => {
    if (!open) return;
    setActive(selectedIndex >= 0 ? selectedIndex : all.findIndex((o) => !o.disabled));
    const close = (event: MouseEvent) => {
      const t = event.target as Node;
      if (!trigger.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
    // Only on open: the highlight should not snap back while the user is moving it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    menu.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function choose(index: number) {
    const option = all[index];
    if (!option || option.disabled) return;
    const next = String(option.value);
    if (value === undefined) setInternalValue(next);
    if (next !== currentValue) {
      const target = { value: next, name } as HTMLSelectElement;
      onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
    }
    setOpen(false);
    trigger.current?.focus();
  }

  function step(from: number, delta: number) {
    for (let i = 1; i <= all.length; i++) {
      const index = (from + delta * i + all.length * 2) % all.length;
      if (!all[index].disabled) return index;
    }
    return from;
  }

  function typeAhead(key: string) {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 600 ? '' : typed.current.text) + key.toLowerCase(), at: now };
    const start = open ? active : selectedIndex;
    for (let i = 1; i <= all.length; i++) {
      const index = (start + i) % all.length;
      if (!all[index].disabled && textOf(all[index].label).toLowerCase().startsWith(typed.current.text)) return index;
    }
    return -1;
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const { key } = event;
    if (key === 'Escape' && open) { event.preventDefault(); setOpen(false); return; }
    if (key === 'Tab') { setOpen(false); return; }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (open && active >= 0) choose(active); else setOpen(true);
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      const delta = key === 'ArrowDown' ? 1 : -1;
      if (open) setActive((a) => step(a < 0 ? selectedIndex : a, delta));
      else if (event.altKey) setOpen(true);
      else choose(step(selectedIndex, delta));
      return;
    }
    if (key === 'Home' || key === 'End') {
      event.preventDefault();
      const index = key === 'Home' ? step(-1, 1) : step(all.length, -1);
      if (open) setActive(index); else choose(index);
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const index = typeAhead(key);
      if (index >= 0) { if (open) setActive(index); else choose(index); }
    }
  }

  const showPlaceholder = !selected || currentValue === '';
  return (
    <span className={['selectWrap', block ? 'block' : '', open ? 'open' : '', className ?? ''].filter(Boolean).join(' ')}>
      <select
        {...rest}
        id={selectId}
        name={name}
        value={currentValue}
        disabled={disabled}
        onChange={onChange}
        aria-hidden="true"
        tabIndex={-1}
        className="selectNative"
        onFocus={() => trigger.current?.focus()}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={String(option.value)} value={option.value} disabled={option.disabled}>
            {textOf(option.label) || String(option.value)}
          </option>
        ))}
        {children}
      </select>
      <button
        ref={trigger}
        type="button"
        className="selectTrigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : `${selectId}-label ${selectId}-value`}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span id={`${selectId}-value`} className={showPlaceholder ? 'selectValue placeholder' : 'selectValue'}>
          {selected?.label ?? placeholder ?? currentValue}
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={menu}
          id={listId}
          className="selectMenu scrollArea"
          role="listbox"
          aria-label={ariaLabel}
          data-side={pos.side}
          style={pos.style}
          onClick={(e) => e.stopPropagation()}
        >
          {all.map((option, index) => {
            const optionValue = String(option.value);
            const isSelected = optionValue === currentValue;
            return (
              <div
                key={optionValue || '__placeholder'}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                className={'selectOption' + (index === active ? ' active' : '') + (optionValue === '' ? ' isPlaceholder' : '')}
                onMouseEnter={() => !option.disabled && setActive(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
              >
                <span className="selectOptionText">
                  <span>{option.label}</span>
                  {option.hint && <small>{option.hint}</small>}
                </span>
                {isSelected && <Check size={15} aria-hidden="true" />}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </span>
  );
}
