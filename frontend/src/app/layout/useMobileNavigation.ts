import { useEffect, useRef, useState } from 'react';

/** Keep the mobile drawer operable by keyboard without exposing the page behind it. */
export function useMobileNavigation(open: boolean, onClose: () => void) {
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 760px)').matches);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const changed = () => setNarrow(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const active = open && narrow;
  useEffect(() => {
    if (!active) return;
    const drawer = document.querySelector<HTMLElement>('.sidebar');
    const restore = document.activeElement as HTMLElement | null;
    const background = [...document.querySelectorAll<HTMLElement>('main,.topbar')];
    const previous = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const controls = () => [...(drawer?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? [])]
      .filter(element => element.getClientRects().length);
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      background.forEach((element, index) => { element.inert = previous[index]; });
      if (restore?.isConnected) restore.focus();
    };
  }, [active]);
  return active;
}
