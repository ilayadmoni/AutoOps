import { useId } from 'react';

/**
 * AutoOps wordmark. The mark is redrawn as vector from the supplied artwork (AutoOpsLogo.png),
 * because the raster carries its own black plate and showed as a grey box on light surfaces.
 * Colours come from tokens, so it reads correctly in both themes without filters.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  const gradient = useId();
  return (
    <svg className="brandMark" width={size * 1.25} height={size} viewBox="0 0 200 160" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-from)" />
          <stop offset="1" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gradient})`} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="22" cy="80" r="14" />
        <circle cx="74" cy="80" r="14" />
        <path d="M36 80h24M88 80h66M108 80c8 0 12-4 12-12V44c0-10 6-16 16-16h18M108 80c8 0 12 4 12 12v24c0 10 6 16 16 16h18" />
        <circle cx="170" cy="28" r="14" />
        <circle cx="170" cy="80" r="14" />
        <circle cx="170" cy="132" r="14" />
      </g>
    </svg>
  );
}

export default function Brand({ size = 28, compact }: { size?: number; compact?: boolean }) {
  return (
    <span className="brand" role="img" aria-label="AutoOps" style={{ fontSize: Math.round(size * 0.72) }}>
      <BrandMark size={size} />
      {!compact && <span className="brandWord" aria-hidden="true">Auto<b>Ops</b></span>}
    </span>
  );
}
