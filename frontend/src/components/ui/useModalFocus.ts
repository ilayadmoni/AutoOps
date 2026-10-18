import { useEffect, useRef, type RefObject } from 'react';

const dialogs: HTMLElement[] = [];
let rootWasInert = false;
let bodyOverflow = '';
const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

/** Portalled dialogs share a stack so only the top one owns focus and Escape. */
export function useModalFocus(dialog: RefObject<HTMLDivElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const restore = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    if (!dialogs.length) {
      rootWasInert = root?.inert ?? false;
      bodyOverflow = document.body.style.overflow;
      if (root) root.inert = true;
      document.body.style.overflow = 'hidden';
    }
    dialogs.push(element);
    element.focus();
    const keyDown = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== element || event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const target = event.target as HTMLElement;
      // Portalled pickers own their own keyboard behavior until dismissed.
      if (!element.contains(target) && target.closest('[role="menu"],[role="listbox"]')) return;
      const focusable = [...element.querySelectorAll<HTMLElement>(selector)]
        .filter(node => node.getClientRects().length && !node.closest('[hidden],[inert],[aria-hidden="true"]'));
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', keyDown);
    return () => {
      window.removeEventListener('keydown', keyDown);
      dialogs.splice(dialogs.indexOf(element), 1);
      if (!dialogs.length) {
        if (root) root.inert = rootWasInert;
        document.body.style.overflow = bodyOverflow;
      }
      if (restore?.isConnected && !restore.closest('[inert]')) restore.focus();
      else dialogs.at(-1)?.focus();
    };
  }, [dialog]);
}
