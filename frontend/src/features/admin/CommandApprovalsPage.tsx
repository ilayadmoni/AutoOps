import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { get, post } from '../../shared/api/client';
import type { Command } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Code, EmptyState, ErrorAlert, Loading, Modal, PageHeader, RiskBadge, Spinner, StatusBadge, errorMessage } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatDate } from '../../shared/format';

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
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {['PENDING', 'APPROVED', 'REJECTED'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}
        </select>
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
              {c.status !== 'APPROVED' && <button className="btn small primary" disabled={approve.isPending} onClick={() => approve.mutate(c.id)}><Check size={14} /> {t('approvals.approve')}</button>}
              {c.status !== 'REJECTED' && <button className="btn small danger ghost" onClick={() => setRejecting(c)}><X size={14} /> {t('approvals.reject')}</button>}
            </article>
          ))}
        </div>
      )}
      {rejecting && (
        <Modal title={t('cmdApprovals.rejectTitle', { name: rejecting.name })} onClose={() => setRejecting(null)} footer={
          <>
            <button className="btn" onClick={() => setRejecting(null)}>{t('common.cancel')}</button>
            <button className="btn danger" disabled={reject.isPending} onClick={() => reject.mutate(rejecting.id)}>{reject.isPending && <Spinner />} {t('approvals.reject')}</button>
          </>
        }>
          <textarea placeholder={t('cmdApprovals.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Modal>
      )}
    </section>
  );
}
