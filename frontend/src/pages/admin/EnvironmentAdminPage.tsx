import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { get } from '../../services/client';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, EmptyState, ErrorAlert, Loading, PageHeader, SearchInput } from '../../components/ui';
import '../../assets/styles/environment.css';

type Setting = { name: string; property: string; value: string | null; configured: boolean; masked: boolean };

export default function EnvironmentAdminPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'environment'], queryFn: () => get<Setting[]>('/admin/environment'),
    gcTime: 0, refetchOnWindowFocus: false,
  });
  const term = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter((row) => `${row.name} ${row.property}`.toLowerCase().includes(term));
  return (
    <section>
      <PageHeader title={t('environment.title')} subtitle={t('environment.subtitle')}
        actions={<Button icon={<RefreshCw size={14} aria-hidden="true" />} busy={query.isFetching}
          onClick={() => query.refetch()}>{t('environment.refresh')}</Button>} />
      <p className="muted small">{t('environment.scope')}</p>
      <div className="toolbar">
        <SearchInput aria-label={t('environment.search')} placeholder={t('environment.search')}
          value={search} onChange={(event) => setSearch(event.target.value)} />
        {query.data && <span className="muted small">{t('environment.count', { visible: rows.length, total: query.data.length })}</span>}
      </div>
      {query.error && <ErrorAlert error={query.error} onRetry={() => query.refetch()} />}
      {query.isLoading ? <Loading /> : query.data && (!rows.length ? <EmptyState title={t('environment.empty')} /> : (
        <div className="environmentTable">
          <table className="table">
            <caption className="muted small">{t('environment.title')}</caption>
            <thead><tr>
              <th scope="col">{t('environment.variable')}</th>
              <th scope="col">{t('environment.value')}</th>
              <th scope="col">{t('environment.status')}</th>
            </tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.name}>
                <th scope="row"><code dir="ltr">{row.name}</code><small className="muted environmentProperty" dir="ltr">{row.property}</small></th>
                <td><span className="mono" dir="ltr">{!row.configured ? '—' : row.masked ? t('environment.masked') : row.value}</span></td>
                <td><span className={'badge ' + (row.configured ? 'ok' : 'neutral')}>
                  {t(row.configured ? 'environment.configured' : 'environment.unset')}
                </span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
