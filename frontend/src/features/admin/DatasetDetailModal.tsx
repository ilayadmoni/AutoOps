import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Code, Field, Loading, Modal, Progress, RiskBadge, Select, StatusBadge, TextInput } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { queryKeys } from '../../lib/queryKeys';
import { adminService } from '../../services/admin';
import { formatBytes } from '../../utils/format';
import { isDatasetBusy } from './datasetStatus';

export default function DatasetDetailModal({ id, onClose, onError }: { id: number; onClose: () => void; onError: (e: unknown) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [approveUpTo, setApproveUpTo] = useState('LOW');
  const [reason, setReason] = useState('');
  const q = useQuery({
    queryKey: queryKeys.admin.dataset(id), queryFn: () => adminService.dataset(id),
    refetchInterval: (query) => (query.state.data && isDatasetBusy(query.state.data.status) ? 1500 : false),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: queryKeys.admin.dataset(id) }); qc.invalidateQueries({ queryKey: queryKeys.admin.datasets }); };
  const confirm = useMutation({ mutationFn: () => adminService.confirmDataset(id, approveUpTo), onSuccess: refresh, onError });
  const reject = useMutation({ mutationFn: () => adminService.rejectDataset(id, reason), onSuccess: refresh, onError });
  const d = q.data;
  return (
    <Modal wide title={d ? d.filename : t('common.loading')} onClose={onClose} footer={d?.status === 'READY_FOR_REVIEW' && (
      <>
        <TextInput className="grow" aria-label={t('cmdApprovals.reason')} placeholder={t('cmdApprovals.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button variant="danger" className="ghost" busy={reject.isPending} onClick={() => reject.mutate()}>{t('approvals.reject')}</Button>
        <Button variant="primary" busy={confirm.isPending} disabled={!d.candidateRecords} onClick={() => confirm.mutate()}>{t('datasets.confirm', { n: d.candidateRecords })}</Button>
      </>
    )}>
      {!d ? <Loading /> : (
        <div className="stack">
          <div className="row gap wrap"><StatusBadge status={d.status} /><span className="muted small">{formatBytes(d.sizeBytes)} · SHA-256 <Code>{d.checksum?.slice(0, 16)}</Code></span></div>
          {d.errorMessage && <div className={'alert ' + (d.status === 'FAILED' ? 'danger' : 'warn')}>{d.errorMessage}</div>}
          <div className="summaryGrid">
            {(['totalRecords', 'candidateRecords', 'invalidRecords', 'nonRhelRecords', 'duplicateRecords', 'processedRecords', 'addedRecords', 'failedRecords'] as const).map((k) => (
              <div key={k}><span className="muted">{t('datasets.' + k)}</span><strong>{d[k]}</strong></div>
            ))}
          </div>
          {d.status === 'IMPORTING' && <Progress max={d.candidateRecords || 1} value={d.processedRecords} />}
          {d.status === 'READY_FOR_REVIEW' && (
            <Field label={t('datasets.approveUpTo')} hint={t('datasets.approveHint')}>
              <Select
                block value={approveUpTo} onChange={(e) => setApproveUpTo(e.target.value)}
                options={[
                  { value: 'NONE', label: t('datasets.approveNone') },
                  { value: 'LOW', label: t('risk.LOW') },
                  { value: 'MEDIUM', label: t('datasets.approveMedium') },
                ]}
              />
            </Field>
          )}
          {d.analysis && (
            <>
              <div className="row gap wrap">{Object.entries(d.analysis.riskCounts).map(([r, n]) => <span key={r}><RiskBadge risk={r} /> {n}</span>)}</div>
              <h3>{t('datasets.preview')}</h3>
              <table className="table">
                <thead><tr><th>{t('datasets.line')}</th><th>{t('common.name')}</th><th>{t('commands.category')}</th><th>{t('commands.template')}</th><th>{t('executions.risk')}</th></tr></thead>
                <tbody>{d.analysis.preview.map((p) => <tr key={p.line}><td>{p.line}</td><td>{p.name}</td><td>{p.category}</td><td><Code>{p.template}</Code></td><td><RiskBadge risk={p.risk} /></td></tr>)}</tbody>
              </table>
              {d.analysis.issues.length > 0 && (
                <>
                  <h3>{t('datasets.issues')}</h3>
                  <table className="table">
                    <thead><tr><th>{t('datasets.line')}</th><th>{t('datasets.kind')}</th><th>{t('datasets.message')}</th></tr></thead>
                    <tbody>{d.analysis.issues.map((i, n) => <tr key={n}><td>{i.line}</td><td><span className="badge warn">{t('datasets.kind.' + i.kind, undefined, i.kind)}</span></td><td>{i.message}</td></tr>)}</tbody>
                  </table>
                </>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
