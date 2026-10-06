import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../shared/api/client';
import type { ApprovalView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState, ErrorAlert, Loading, PageHeader } from '../../shared/ui';
import { ApprovalCard } from '../executions/ApprovalCard';

export default function ApprovalsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ['approvals', 'pending', all], queryFn: () => get<ApprovalView[]>('/approvals/pending' + (all ? '?all=true' : '')), refetchInterval: 5000 });
  return (
    <section>
      <PageHeader title={t('approvals.title')} subtitle={t('approvals.subtitle')}
        actions={isAdmin && <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('executions.allUsers')}</label>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('approvals.empty')} />
      ) : (
        <div className="stack">{q.data.map((a) => <ApprovalCard key={a.id} approval={a} showLink />)}</div>
      )}
    </section>
  );
}
