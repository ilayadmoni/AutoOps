import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import type { Command } from '../../types/api';
import {
  Button, Code, EmptyState, ErrorAlert, Loading, PageHeader, RiskBadge, Select, StatusBadge, errorMessage,
} from '../../components';
import RejectCommandModal from '../../features/admin/RejectCommandModal';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/queryKeys';
import { adminService } from '../../services/admin';
import { formatDate } from '../../utils/format';

export default function CommandApprovalsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const [rejecting, setRejecting] = useState<Command | null>(null);
  const q = useQuery({ queryKey: queryKeys.admin.commands.byStatus(status), queryFn: () => adminService.commands(status) });
  const refresh = () => { qc.invalidateQueries({ queryKey: queryKeys.admin.commands.all }); qc.invalidateQueries({ queryKey: queryKeys.commands.all }); };
  const approve = useMutation({ mutationFn: adminService.approveCommand, onSuccess: () => { toast.success(t('cmdApprovals.approved')); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  return (
    <section>
      <PageHeader title={t('cmdApprovals.title')} subtitle={t('cmdApprovals.subtitle')} actions={
        <Select
          aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)}
          options={['PENDING', 'APPROVED', 'REJECTED'].map((s) => ({ value: s, label: t('status.' + s) }))}
        />
      } />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} /> : !q.data?.length ? <EmptyState title={t('cmdApprovals.empty')} /> : (
        <div className="list">
          {q.data.map((c) => (
            <article className="row wrap" key={c.id}>
              <div className="grow stack tight">
                <b>{c.name}</b>
                <small className="muted">{c.category} · {t('source.' + c.source, undefined, c.source)} · {formatDate(c.createdAt, lang)}</small>
                {c.description && <small>{c.description}</small>}
                <Code>{c.commandTemplate}</Code>
                {c.parameters.length > 0 && <small className="muted">{t('commands.parameters')}: {c.parameters.map((p) => p.name + ':' + (p.type ?? 'STRING')).join(', ')}</small>}
              </div>
              <RiskBadge risk={c.riskLevel} />
              <StatusBadge status={c.status} />
              {c.status !== 'APPROVED' && <Button small variant="primary" icon={<Check size={14} />} busy={approve.isPending} onClick={() => approve.mutate(c.id)}>{t('approvals.approve')}</Button>}
              {c.status !== 'REJECTED' && <Button small variant="danger" className="ghost" icon={<X size={14} />} onClick={() => setRejecting(c)}>{t('approvals.reject')}</Button>}
            </article>
          ))}
        </div>
      )}
      {rejecting && <RejectCommandModal command={rejecting} onClose={() => setRejecting(null)} onRejected={refresh} />}
    </section>
  );
}
