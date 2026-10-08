import { useState } from 'react';
import { Checkbox, EmptyState, ErrorAlert, Loading, PageHeader } from '../components';
import ApprovalCard from '../features/approvals/ApprovalCard';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { usePendingApprovals } from '../hooks/usePendingApprovals';

export default function ApprovalsPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [all, setAll] = useState(false);
  const q = usePendingApprovals(all, 5000);
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
