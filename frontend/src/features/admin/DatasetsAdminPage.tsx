import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { get, post, upload } from '../../shared/api/client';
import type { DatasetView } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import {
  Button, Code, EmptyState, ErrorAlert, Field, Loading, Modal, PageHeader, RiskBadge, Select,
  StatusBadge, TextInput, errorMessage,
} from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatBytes, formatDate } from '../../shared/format';

const BUSY = ['UPLOADED', 'ANALYZING', 'IMPORTING'];

export default function DatasetsAdminPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ['admin', 'datasets'], queryFn: () => get<DatasetView[]>('/admin/datasets'),
    refetchInterval: (query) => (query.state.data?.some((d) => BUSY.includes(d.status)) ? 2000 : false),
  });
  const up = useMutation({
    mutationFn: (f: File) => upload<DatasetView>('/admin/datasets/upload', f),
    onSuccess: (d) => { toast.success(t('datasets.uploaded')); qc.invalidateQueries({ queryKey: ['admin', 'datasets'] }); setOpenId(d.id); },
  });
  return (
    <section>
      <PageHeader title={t('datasets.title')} subtitle={t('datasets.subtitle')} actions={
        <>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) up.mutate(f); }} />
          <Button variant="primary" icon={<FileUp size={16} />} busy={up.isPending} onClick={() => input.current?.click()}>{t('datasets.upload')}</Button>
        </>
      } />
      <p className="muted small">{t('datasets.format')} <Code>name, description, category, command, os, parameters</Code></p>
      <ErrorAlert error={up.error} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} /> : !q.data?.length ? <EmptyState title={t('datasets.empty')} /> : (
        <table className="table">
          <thead><tr><th>#</th><th>{t('files.name')}</th><th>{t('common.status')}</th><th>{t('datasets.rows')}</th><th>{t('datasets.candidates')}</th><th>{t('datasets.added')}</th><th>{t('files.uploadedAt')}</th><th /></tr></thead>
          <tbody>
            {q.data.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td><td dir="ltr">{d.filename}</td><td><StatusBadge status={d.status} /></td><td>{d.totalRecords}</td>
                <td>{d.candidateRecords}</td><td>{d.addedRecords}</td><td>{formatDate(d.createdAt, lang)}</td>
                <td><Button small onClick={() => setOpenId(d.id)}>{d.status === 'READY_FOR_REVIEW' ? t('datasets.review') : t('admin.open')}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {openId != null && <DatasetDetail id={openId} onClose={() => setOpenId(null)} onError={(e) => toast.error(errorMessage(e))} />}
    </section>
  );
}

function DatasetDetail({ id, onClose, onError }: { id: number; onClose: () => void; onError: (e: unknown) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [approveUpTo, setApproveUpTo] = useState('LOW');
  const [reason, setReason] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'dataset', id], queryFn: () => get<DatasetView>('/admin/datasets/' + id),
    refetchInterval: (query) => (query.state.data && BUSY.includes(query.state.data.status) ? 1500 : false),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin', 'dataset', id] }); qc.invalidateQueries({ queryKey: ['admin', 'datasets'] }); };
  const confirm = useMutation({ mutationFn: () => post<DatasetView>(`/admin/datasets/${id}/confirm`, { approveUpTo }), onSuccess: refresh, onError });
  const reject = useMutation({ mutationFn: () => post<DatasetView>(`/admin/datasets/${id}/reject`, { reason }), onSuccess: refresh, onError });
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
          {d.status === 'IMPORTING' && <progress max={d.candidateRecords || 1} value={d.processedRecords} />}
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
