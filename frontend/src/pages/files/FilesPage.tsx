import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2 } from 'lucide-react';
import { del, get, getAccessToken, upload } from '../../services/client';
import type { StoredFile } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Code, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, FilePicker, IconButton, Loading, PageHeader,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatBytes, formatDate } from '../../utils/format';

export const filesQuery = { queryKey: ['files'], queryFn: () => get<StoredFile[]>('/files') };

export function useUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: File) => upload<StoredFile>('/files', f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files'] }),
  });
}

async function download(f: StoredFile) {
  const r = await fetch('/api/files/' + f.id + '/content', { headers: { Authorization: 'Bearer ' + (getAccessToken() ?? '') } });
  if (!r.ok) throw new Error('Download failed');
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = f.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FilesPage() {
  const { t, lang } = useI18n();
  const q = useQuery(filesQuery);
  const qc = useQueryClient();
  const toast = useToast();
  const up = useUpload();
  const [deleting, setDeleting] = useState<StoredFile | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => del('/files/' + id),
    onSuccess: () => { toast.success(t('files.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: ['files'] }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  const onPick = (file?: File) => file && up.mutate(file, { onSuccess: () => toast.success(t('files.uploaded', { name: file.name })) });
  return (
    <section>
      <PageHeader title={t('files.title')} subtitle={t('files.subtitle')} />
      <FilePicker onPick={onPick}>
        {(open) => <Fab label={t('files.upload')} busy={up.isPending} onClick={open} />}
      </FilePicker>
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
                <td className="actionsCell"><div className="row gap">
                  <IconButton label={t('files.download')} onClick={() => download(f).catch((e) => toast.error(errorMessage(e)))}><Download size={14} /></IconButton>
                  <IconButton danger label={t('common.delete')} disabled={f.referencedBy.length > 0} hint={f.referencedBy.length ? t('files.inUse') : undefined} onClick={() => setDeleting(f)}><Trash2 size={14} /></IconButton>
                </div></td>
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
