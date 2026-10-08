import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { Button, Code, EmptyState, ErrorAlert, FilePicker, Loading, PageHeader, StatusBadge, errorMessage } from '../../components';
import DatasetDetailModal from '../../features/admin/DatasetDetailModal';
import { isDatasetBusy } from '../../features/admin/datasetStatus';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/queryKeys';
import { adminService } from '../../services/admin';
import { formatDate } from '../../utils/format';

export default function DatasetsAdminPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useQuery({
    queryKey: queryKeys.admin.datasets, queryFn: adminService.datasets,
    refetchInterval: (query) => (query.state.data?.some((d) => isDatasetBusy(d.status)) ? 2000 : false),
  });
  const up = useMutation({
    mutationFn: adminService.uploadDataset,
    onSuccess: (d) => { toast.success(t('datasets.uploaded')); qc.invalidateQueries({ queryKey: queryKeys.admin.datasets }); setOpenId(d.id); },
  });
  return (
    <section>
      <PageHeader title={t('datasets.title')} subtitle={t('datasets.subtitle')} actions={
        <FilePicker accept=".csv,text/csv" onPick={(file) => { if (file) up.mutate(file); }}>
          {(open) => <Button variant="primary" icon={<FileUp size={16} />} busy={up.isPending} onClick={open}>{t('datasets.upload')}</Button>}
        </FilePicker>
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
      {openId != null && <DatasetDetailModal id={openId} onClose={() => setOpenId(null)} onError={(e) => toast.error(errorMessage(e))} />}
    </section>
  );
}
