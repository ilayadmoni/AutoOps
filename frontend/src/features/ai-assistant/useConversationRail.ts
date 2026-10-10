import { useState } from 'react';

const KEY = 'autoops.ai.historyOpen';
function initialRail() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === '1' || saved === '0') return saved === '1';
  } catch { /* Fall back to the viewport when storage is unavailable. */ }
  return window.innerWidth >= 1180;
}
export function useConversationRail() {
  const [railOpen, setRailOpen] = useState(initialRail);
  const toggleRail = (open: boolean) => {
    setRailOpen(open);
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* Viewing preference only. */ }
  };
  return { railOpen, setRailOpen, toggleRail };
}
