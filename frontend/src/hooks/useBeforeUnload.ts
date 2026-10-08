import { useEffect } from 'react';

/** Asks the browser to confirm leaving the page while `active` (e.g. unsaved changes). */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [active]);
}
