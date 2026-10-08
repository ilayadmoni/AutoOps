import {
  cloneElement, useEffect, useId, useRef, useState,
  type KeyboardEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { useFloating, type Side } from './floating';

export type MenuItem = { key: string; label: ReactNode; hint?: ReactNode; icon?: ReactNode; danger?: boolean; onSelect: () => void };

type TriggerProps = {
  ref?: Ref<HTMLElement>;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  'aria-haspopup'?: 'menu';
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
};

/**
 * Action menu. Wraps a single trigger element (usually a Button or IconButton's button) and
 * opens a portalled list of commands. Arrow keys move between items, Enter runs one, Escape
 * and outside clicks close it and return focus to the trigger.
 */
export default function Menu({ trigger, items, label, side = 'bottom' }: {
  trigger: ReactElement<TriggerProps>;
  items: MenuItem[];
  label: string;
  side?: Side;
}) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pos = useFloating(open, anchor, layer, { side });

  useEffect(() => {
    if (!open) return;
    // The layer is hidden until useFloating has measured it, and a hidden element cannot take
    // focus; wait a frame so the first item is visible before moving focus into the menu.
    const frame = requestAnimationFrame(() => layer.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchor.current?.contains(t) && !layer.current?.contains(t)) setOpen(false);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); anchor.current?.focus(); }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const dismiss = () => { setOpen(false); anchor.current?.focus(); };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = [...(layer.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); dismiss(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(at + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(at - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
  };

  const original = trigger.props;
  const anchored = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      anchor.current = node;
      const r = original.ref;
      if (typeof r === 'function') r(node); else if (r && typeof r === 'object') (r as { current: HTMLElement | null }).current = node;
    },
    onClick: (e) => { original.onClick?.(e); e.stopPropagation(); setOpen((v) => !v); },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
  });

  return (
    <>
      {anchored}
      {open && createPortal(
        <div ref={layer} id={id} className="menu" role="menu" aria-label={label} style={pos.style} data-side={pos.side} onKeyDown={onKeyDown}
          // React events bubble through portals to the trigger's ancestors (a canvas node, a
          // clickable row); a choice made in the menu must not also count as a click on them.
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={'menuItem' + (item.danger ? ' danger' : '')}
              onClick={() => { setOpen(false); item.onSelect(); }}
            >
              {item.icon && <span className="menuIcon">{item.icon}</span>}
              <span className="menuText">
                <span>{item.label}</span>
                {item.hint && <small>{item.hint}</small>}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
