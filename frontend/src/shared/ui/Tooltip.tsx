import {
  cloneElement, isValidElement, useEffect, useId, useRef, useState,
  type FocusEvent, type PointerEvent, type ReactElement, type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { useFloating, type Side } from './floating';

type TriggerProps = {
  ref?: Ref<HTMLElement>;
  'aria-describedby'?: string;
  onPointerEnter?: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
};

const OPEN_DELAY = 400;

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref && typeof ref === 'object') (ref as { current: T }).current = value;
}

/**
 * Themed tooltip. The child keeps its own box (no wrapper element), so layout rules written for
 * the trigger still apply. The bubble is portalled and positioned by `useFloating`, which keeps it
 * clear of `overflow: hidden` panels and the viewport edge. It opens on hover after a short delay
 * and immediately on keyboard focus, and Escape dismisses it.
 *
 * `describe` links the text through aria-describedby. Leave it off when the trigger already uses
 * the same text as its accessible name (an icon button's label), or it is announced twice.
 */
export default function Tooltip({ text, children, side = 'top', describe = true }: {
  text: string;
  children: ReactElement;
  side?: Side;
  describe?: boolean;
}) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const [open, setOpen] = useState(false);
  const pos = useFloating(open, anchor, layer, { side, align: 'center' });

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!isValidElement<TriggerProps>(children) || !text) return children;
  const props = children.props;

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      anchor.current = node;
      assignRef(props.ref, node);
    },
    'aria-describedby': describe ? [props['aria-describedby'], id].filter(Boolean).join(' ') : props['aria-describedby'],
    onPointerEnter: (e) => { props.onPointerEnter?.(e); if (e.pointerType === 'mouse') show(OPEN_DELAY); },
    onPointerLeave: (e) => { props.onPointerLeave?.(e); hide(); },
    onFocus: (e) => { props.onFocus?.(e); if (e.currentTarget.matches(':focus-visible')) show(0); },
    onBlur: (e) => { props.onBlur?.(e); hide(); },
  });

  return (
    <>
      {trigger}
      {describe && <span id={id} hidden>{text}</span>}
      {open && createPortal(
        <div ref={layer} className="tooltip" data-side={pos.side} role="tooltip" style={pos.style}>
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
