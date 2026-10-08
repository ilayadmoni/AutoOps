import Brand from './Brand';
import { useI18n } from '../hooks/useI18n';

export function Spinner({ tone = 'accent' }: { tone?: 'accent' | 'ink' }) {
  return <span className={`aoRing ${tone === 'ink' ? 'aoRingInk' : ''}`} aria-hidden="true" />;
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="status" aria-live="polite">
      <Spinner />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function BootLoader() {
  const { t } = useI18n();
  const label = t('common.starting');
  return (
    <div className="bootLoader" role="status" aria-live="polite">
      <Brand size={34} />
      <div className="bootProgress" role="progressbar" aria-label={label}>
        <span />
      </div>
      <div className="bootCommand" dir="ltr">
        <span>$</span> {label}<i aria-hidden="true" />
      </div>
    </div>
  );
}

export function SkeletonList({ rows = 3, label }: { rows?: number; label?: string }) {
  const { t } = useI18n();
  return (
    <div className="skeletonList" role="status" aria-label={label ?? t('common.loading')}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeletonRow" key={index} aria-hidden="true">
          <span className="skeletonBlock skeletonIcon" />
          <span className="skeletonCopy">
            <span className="skeletonBlock" />
            <span className="skeletonBlock" />
          </span>
          <span className="skeletonBlock skeletonBadge" />
        </div>
      ))}
    </div>
  );
}
