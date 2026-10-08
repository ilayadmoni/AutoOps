import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Trash2 } from 'lucide-react';
import type { StoredFile } from '../types/api';
import {
  Button, Code, ConfirmDialog, EmptyState, ErrorAlert, FilePicker, IconButton, Loading, PageHeader, errorMessage,
} from '../components';
import { useFiles, useUploadFile } from '../hooks/useFiles';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { queryKeys } from '../lib/queryKeys';
import { filesService } from '../services/files';
import { saveBlob } from '../utils/download';
import { formatBytes, formatDate } from '../utils/format';

async function download(f: StoredFile) {
  saveBlob(await filesService.content(f.id), f.filename);
}

export default function FilesPage() {
  const { t, lang } = useI18n();
  const q = useFiles();
  const qc = useQueryClient();
  const toast = useToast();
  const up = useUploadFile();
  const [deleting, setDeleting] = useState<StoredFile | null>(null);
  const remove = useMutation({
    mutationFn: filesService.remove,
    onSuccess: () => { toast.success(t('files.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: queryKeys.files }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  const onPick = (file?: File) => file && up.mutate(file, { onSuccess: () => toast.success(t('files.uploaded', { name: file.name })) });
  return (
    <section>
      <PageHeader title={t('files.title')} subtitle={t('files.subtitle')} actions={
        <FilePicker onPick={onPick}>
          {(open) => <Button variant="primary" icon={<FileUp size={16} />} busy={up.isPending} onClick={open}>{t('files.upload')}</Button>}
        </FilePicker>
      } />
      <ErrorAlert error={up.error} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('files.empty')} hint={t('files.emptyHint')} />
      ) : (
        <table className="table">
          <thead><tr><th>{t('files.name')}</th><th>{t('files.size')}</th><th>SHA-256</th><th>{t('files.usedBy')}</th><th>{t('files.uploadedAt')}</th><th /></tr></thead>
          <tbody>
            {q.data.map((f) => (
              <tr key={f.id}>
                <td dir="ltr">{f.filename}</td>
                <td>{formatBytes(f.size)}</td>
                <td><Code>{f.checksum.slice(0, 16)}</Code></td>
                <td>{f.referencedBy.length ? f.referencedBy.join(', ') : <span className="muted">{t('files.unused')}</span>}</td>
                <td>{formatDate(f.createdAt, lang)}</td>
                <td className="row gap">
                  <IconButton label={t('files.download')} onClick={() => download(f).catch((e) => toast.error(errorMessage(e)))}><Download size={14} /></IconButton>
                  <IconButton danger label={t('common.delete')} disabled={f.referencedBy.length > 0} title={f.referencedBy.length ? t('files.inUse') : t('common.delete')} onClick={() => setDeleting(f)}><Trash2 size={14} /></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {deleting && <ConfirmDialog danger title={t('files.deleteTitle')} message={t('files.deleteMessage', { name: deleting.filename })} confirmLabel={t('common.delete')}
        busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}
