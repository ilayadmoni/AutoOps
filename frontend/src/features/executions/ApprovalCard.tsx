import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, X } from 'lucide-react';
import { ApiError, post } from '../../shared/api/client';
import type { ApprovalView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, Checkbox, ErrorAlert, RiskBadge, TextInput } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatDate } from '../../shared/format';

/** Persisted approval decision: explicit Run click, plus acknowledgement for HIGH risk (enforced by the backend too). */
export function ApprovalCard({ approval, showLink }: { approval: ApprovalView; showLink?: boolean }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [ack, setAck] = useState(false);
  const [comment, setComment] = useState('');
  const high = approval.riskLevel === 'HIGH';
  const decide = useMutation({
    mutationFn: (approve: boolean) => post<ApprovalView>(`/approvals/${approval.id}/decision`, { approve, highRiskAcknowledged: approve && ack, comment: comment || null }),
    onSuccess: (a) => {
      toast.success(a.status === 'APPROVED' ? t('approvals.approved') : t('approvals.rejected'));
      qc.invalidateQueries({ queryKey: ['execution', approval.executionId] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
  return (
    <div className={'approval ' + (high ? 'high' : '')}>
      <div className="row spread wrap">
        <div>
          <strong>{approval.scope === 'STEP' ? t('approvals.stepGate', { step: approval.stepName ?? '', machine: approval.machineName ?? '' }) : t('approvals.executionGate')}</strong>
          {showLink && <div><Link to={'/executions/' + approval.executionId}>#{approval.executionId} {approval.executionTitle}</Link></div>}
          <small className="muted">{approval.reason} · {formatDate(approval.requestedAt, lang)}</small>
        </div>
        <RiskBadge risk={approval.riskLevel} />
      </div>
      {decide.error && <ErrorAlert error={decide.error as ApiError} />}
      {high && (
        <Checkbox
          danger checked={ack} onChange={(e) => setAck(e.target.checked)}
          label={<><AlertTriangle size={14} /> {t('approvals.ack')}</>}
        />
      )}
      <div className="row gap wrap">
        <TextInput className="grow" aria-label={t('approvals.comment')} placeholder={t('approvals.comment')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
        <Button variant="danger" className="ghost" icon={<X size={14} />} disabled={decide.isPending} onClick={() => decide.mutate(false)}>{t('approvals.reject')}</Button>
        <Button
          variant={high ? 'danger' : 'primary'} icon={<Check size={14} />}
          busy={decide.isPending} disabled={high && !ack} onClick={() => decide.mutate(true)}
        >
          {approval.scope === 'EXECUTION' ? t('approvals.run') : t('approvals.approve')}
        </Button>
      </div>
    </div>
  );
}
