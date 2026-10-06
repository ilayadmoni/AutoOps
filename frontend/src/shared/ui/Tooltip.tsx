import type { ReactNode } from 'react';

/**
 * CSS-only tooltip. The text is always in the DOM (not inserted on hover) so screen readers
 * reach it, and `focus-within` means keyboard users see it without a pointer.
 */
export default function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="tip">
      {children}
      <span data-tip role="tooltip">{text}</span>
    </span>
  );
}
