import { useI18n } from '../../../app/providers/I18nProvider';
import type { ImportResult } from './types';

export default function ImportResults({ result }: { result: ImportResult }) {
  const { t } = useI18n();
  return <div className="stack">
    <p role="status" className="alert info">{t('machineImport.summary', { imported: result.imported, skipped: result.skipped, failed: result.failed })}</p>
    <ul className="importSessions">
      {result.outcomes.map(row => <li className="importSession" key={row.index}>
        <div className="row spread"><strong>{row.name}</strong>
          <span className={'badge ' + (row.status === 'IMPORTED' ? 'ok' : row.status === 'FAILED' ? 'bad' : 'warn')}>
            {t('machineImport.' + row.status.toLowerCase())}
          </span>
        </div>
        {row.reason && <small className="muted">{t('machineImport.reason.' + row.reason)}</small>}
      </li>)}
    </ul>
  </div>;
}
