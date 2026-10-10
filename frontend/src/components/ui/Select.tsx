import {
  isValidElement, useEffect, useId, useRef, useState,
  type ChangeEvent, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useI18n } from '../../app/providers/I18nProvider';
import { useFloating } from './floating';

/** `search` overrides the text matched against the query when the label is not plain text. */
export type SelectOption = { value: string | number; label: ReactNode; hint?: ReactNode; disabled?: boolean; search?: string };

/** Lists longer than this get a search field; shorter ones stay a plain list. */
const SEARCH_THRESHOLD = 7;

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  options?: SelectOption[];
  children?: ReactNode;
  placeholder?: string;
  block?: boolean;
  /** Force the search field on or off. Defaults to on for lists longer than a handful of options. */
  searchable?: boolean;
};

const textOf = (label: ReactNode): string => {
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  if (Array.isArray(label)) return label.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(label)) return textOf(label.props.children);
  return '';
};

/**
 * Themed listbox. A visually hidden native `<select>` keeps `name`, form submission and label
 * association working; the visible trigger and the portalled list carry the interaction.
 *
 * Keyboard: Enter / Space / Arrow keys open the list, arrows move the highlight without
 * committing, Enter commits, Escape closes, typing jumps to the first matching option, and
 * arrows on the closed trigger step the value directly (as a native select does).
 */
export default function Select({
  options = [], children, placeholder, block, searchable, className, value, defaultValue,
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
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const pos = useFloating(open, trigger, menu, { matchWidth: true, offset: 4 });

  const currentValue = value !== undefined && value !== null ? String(value) : internalValue;
  const all: SelectOption[] = placeholder !== undefined ? [{ value: '', label: placeholder }, ...options] : options;
  const selectedIndex = all.findIndex((o) => String(o.value) === currentValue);
  const selected = all[selectedIndex];
  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const needle = query.trim().toLowerCase();
  // Indices into `all` that survive the query; the placeholder row is dropped while searching.
  const shown = all.map((_, i) => i).filter((i) => {
    if (!needle) return true;
    const o = all[i];
    return String(o.value) !== '' && `${o.search ?? textOf(o.label)} ${textOf(o.hint)}`.toLowerCase().includes(needle);
  });

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    setActive(selectedIndex >= 0 ? selectedIndex : all.findIndex((o) => !o.disabled));
    if (withSearch) requestAnimationFrame(() => search.current?.focus());
    const close = (event: MouseEvent) => {
      const t = event.target as Node;
      if (!trigger.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
    // Only on open: the highlight should not snap back while the user is moving it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Typing narrows the list; keep the highlight on the first surviving option so Enter picks it.
  useEffect(() => {
    if (open && needle) setActive(all.findIndex((_, i) => shown.includes(i) && !all[i].disabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);

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
    const pool = open ? shown : all.map((_, i) => i);
    if (!pool.length) return from;
    const at = pool.indexOf(from);
    for (let i = 1; i <= pool.length; i++) {
      const index = pool[((at < 0 ? (delta > 0 ? -1 : 0) : at) + delta * i + pool.length * 2) % pool.length];
      if (!all[index].disabled) return index;
    }
    return from;
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const { key } = event;
    if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    else if (key === 'Tab') setOpen(false);
    else if (key === 'ArrowDown' || key === 'ArrowUp') { event.preventDefault(); setActive((a) => step(a, key === 'ArrowDown' ? 1 : -1)); }
    else if (key === 'Enter') { event.preventDefault(); if (shown.includes(active)) choose(active); }
  }

  function typeAhead(key: string) {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 600 ? '' : typed.current.text) + key.toLowerCase(), at: now };
    const start = open ? active : selectedIndex;
    if (open && withSearch) return -1;
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
          {withSearch && (
            <div className="selectSearch">
              <Search size={14} aria-hidden="true" />
              <input
                ref={search} type="text" value={query} placeholder={t('select.search')} aria-label={t('select.search')}
                aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                autoComplete="off" spellCheck={false}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
              />
            </div>
          )}
          {!shown.length && <div className="selectEmpty">{t('select.noResults')}</div>}
          {shown.map((index) => {
            const option = all[index];
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
