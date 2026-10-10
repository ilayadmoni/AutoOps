import Brand from './Brand';
import { useI18n } from '../../app/providers/I18nProvider';

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

/**
 * A long-running job in a panel: spinner, title, detail, then a bar. With `max` the bar is determinate
 * (value of max); without it the bar sweeps, for work whose size is not known yet.
 */
export function ProgressPanel({ title, detail, value = 0, max, note }: {
  title: string; detail?: string; value?: number; max?: number; note?: string;
}) {
  const determinate = max != null && max > 0;
  const percent = determinate ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progressPanel" role="status" aria-live="polite">
      <Spinner />
      <strong>{title}</strong>
      {detail && <span className="muted">{detail}</span>}
      <div
        className={'progress' + (determinate ? '' : ' indeterminate')} role="progressbar" aria-label={title}
        aria-valuemin={0} aria-valuemax={determinate ? max : undefined} aria-valuenow={determinate ? Math.min(max, value) : undefined}
      >
        <span style={determinate ? { width: percent + '%' } : undefined} />
      </div>
      {note && <small className="muted">{note}</small>}
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
