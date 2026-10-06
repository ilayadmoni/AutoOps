import type { CSSProperties } from 'react';

/** Crops the supplied horizontal artwork into a compact, reusable wordmark. */
export default function Brand({ size = 28 }: { size?: number }) {
  const style = {
    '--brand-width': `${Math.round(size * 5.4)}px`,
    '--brand-height': `${Math.round(size * 1.65)}px`,
  } as CSSProperties;
  return (
    <div className="brand" style={style}>
      <img className="brandLogo" src="/AutoOpsLogo.png" alt="AutoOps" />
    </div>
  );
}
