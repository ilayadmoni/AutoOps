import type { CSSProperties } from 'react';
import logo from '../assets/images/AutoOpsLogo.png';

/** Crops the supplied horizontal artwork into a compact, reusable wordmark. */
export default function Brand({ size = 28 }: { size?: number }) {
  const style = {
    '--brand-width': `${Math.round(size * 5.4)}px`,
    '--brand-height': `${Math.round(size * 1.65)}px`,
  } as CSSProperties;
  return (
    <div className="brand" style={style}>
      <img className="brandLogo" src={logo} alt="AutoOps" />
    </div>
  );
}
