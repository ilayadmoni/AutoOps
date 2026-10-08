import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export type Side = 'top' | 'bottom';
export type Align = 'start' | 'center';

const GAP = 8;

/**
 * Positions a floating layer (tooltip, menu, select list) against an anchor. The layer is
 * rendered into a portal with `position: fixed`, so no scrolling or `overflow: hidden` ancestor
 * can clip it. It flips to the other side when the preferred one lacks room, keeps inside the
 * viewport, and aligns to the anchor's inline-start edge, which is the right edge under RTL.
 */
export function useFloating(open: boolean, anchor: RefObject<HTMLElement | null>, layer: RefObject<HTMLElement | null>, {
  side = 'bottom', align = 'start', offset = 6, matchWidth = false,
}: { side?: Side; align?: Align; offset?: number; matchWidth?: boolean } = {}) {
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' });
  const [placed, setPlaced] = useState<Side>(side);

  const update = useCallback(() => {
    const a = anchor.current;
    const f = layer.current;
    if (!a || !f) return;
    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (matchWidth) f.style.minWidth = `${r.width}px`;
    const w = f.offsetWidth;
    const h = f.offsetHeight;

    const below = vh - r.bottom - offset - GAP;
    const above = r.top - offset - GAP;
    const next: Side = side === 'bottom'
      ? (below < h && above > below ? 'top' : 'bottom')
      : (above < h && below > above ? 'bottom' : 'top');
    const top = next === 'bottom' ? r.bottom + offset : r.top - offset - h;

    const rtl = getComputedStyle(a).direction === 'rtl';
    let left = align === 'center' ? r.left + r.width / 2 - w / 2 : rtl ? r.right - w : r.left;
    left = Math.min(Math.max(GAP, left), vw - w - GAP);

    setPlaced(next);
    setStyle({
      position: 'fixed',
      top: Math.max(GAP, top),
      left,
      maxHeight: Math.max(120, (next === 'bottom' ? below : above)),
    });
  }, [anchor, layer, side, align, offset, matchWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    // Capture phase: any scrolling ancestor, not only the window, moves the anchor.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, update]);

  return { style, side: placed, update };
}
