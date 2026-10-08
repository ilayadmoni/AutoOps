import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../../services/client';
import type { ApprovalView } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { useAuth } from '../../app/providers/AuthProvider';
import { Checkbox, EmptyState, ErrorAlert, Loading, PageHeader } from '../../components/ui';
import { ApprovalCard } from '../../features/executions/ApprovalCard';

export default function ApprovalsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ['approvals', 'pending', all], queryFn: () => get<ApprovalView[]>('/approvals/pending' + (all ? '?all=true' : '')), refetchInterval: 5000 });
  return (
    <section>
      <PageHeader title={t('approvals.title')} subtitle={t('approvals.subtitle')}
        actions={isAdmin && <Checkbox checked={all} onChange={(e) => setAll(e.target.checked)} label={t('executions.allUsers')} />} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('approvals.empty')} />
      ) : (
        <div className="stack">{q.data.map((a) => <ApprovalCard key={a.id} approval={a} showLink />)}</div>
      )}
    </section>
  );
}
