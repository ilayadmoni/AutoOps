import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { get, post } from '../../services/client';
import type { Command } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Button, Code, EmptyState, ErrorAlert, Loading, Modal, PageHeader, RiskBadge, Select,
  StatusBadge, Textarea, errorMessage,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../utils/format';

export default function CommandApprovalsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const [rejecting, setRejecting] = useState<Command | null>(null);
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['admin', 'commands', status], queryFn: () => get<Command[]>('/admin/commands?status=' + status) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin', 'commands'] }); qc.invalidateQueries({ queryKey: ['commands'] }); };
  const approve = useMutation({ mutationFn: (id: number) => post<Command>(`/admin/commands/${id}/approve`), onSuccess: () => { toast.success(t('cmdApprovals.approved')); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const reject = useMutation({
    mutationFn: (id: number) => post<Command>(`/admin/commands/${id}/reject`, { reason }),
    onSuccess: () => { toast.success(t('cmdApprovals.rejected')); setRejecting(null); setReason(''); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
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
      {rejecting && (
        <Modal title={t('cmdApprovals.rejectTitle', { name: rejecting.name })} onClose={() => setRejecting(null)} footer={
          <>
            <Button onClick={() => setRejecting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" busy={reject.isPending} onClick={() => reject.mutate(rejecting.id)}>{t('approvals.reject')}</Button>
          </>
        }>
          <Textarea aria-label={t('cmdApprovals.reason')} placeholder={t('cmdApprovals.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Modal>
      )}
    </section>
  );
}
