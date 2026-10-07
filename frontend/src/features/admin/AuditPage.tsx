import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../shared/api/client';
import type { AuditEvent, Page } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, Code, EmptyState, ErrorAlert, Loading, PageHeader, Select, TextInput } from '../../shared/ui';
import { formatDate } from '../../shared/format';

export default function AuditPage() {
  const { t, lang } = useI18n();
  const [page, setPage] = useState(0);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'audit', page, action, entityType],
    queryFn: () => get<Page<AuditEvent>>(`/admin/audit?page=${page}&size=50&action=${encodeURIComponent(action)}&entityType=${encodeURIComponent(entityType)}`),
  });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.size)) : 1;
  return (
    <section>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      <div className="toolbar">
        <TextInput
          dir="ltr" className="grow" aria-label={t('audit.action')} placeholder={t('audit.action')}
          value={action} onChange={(e) => { setAction(e.target.value.toUpperCase()); setPage(0); }}
        />
        <Select
          aria-label={t('audit.entity')} placeholder={t('audit.allEntities')}
          value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0); }}
          options={['USER', 'MACHINE', 'CREDENTIAL', 'COMMAND', 'EXECUTION', 'WORKFLOW', 'FILE', 'DATASET', 'CONVERSATION'].map((x) => ({ value: x, label: x }))}
        />
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} /> : !q.data?.items.length ? <EmptyState title={t('audit.empty')} /> : (
        <>
          <table className="table">
            <thead><tr><th>{t('audit.time')}</th><th>{t('audit.user')}</th><th>{t('audit.action')}</th><th>{t('audit.entity')}</th><th>{t('audit.details')}</th></tr></thead>
            <tbody>{q.data.items.map((e) => (
              <tr key={e.id}><td>{formatDate(e.createdAt, lang)}</td><td>{e.userId ?? '-'}</td><td><Code>{e.action}</Code></td><td>{e.entityType}{e.entityId ? ' #' + e.entityId : ''}</td><td><Code>{e.metadata}</Code></td></tr>
            ))}</tbody>
          </table>
          <div className="pager">
            <Button small disabled={page === 0} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button>
            <span className="tabular">{page + 1} / {pages}</span>
            <Button small disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
          </div>
        </>
      )}
    </section>
  );
}
