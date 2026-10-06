import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Trash2 } from 'lucide-react';
import { del, get, getAccessToken, upload } from '../../shared/api/client';
import type { StoredFile } from '../../shared/api/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Code, ConfirmDialog, EmptyState, ErrorAlert, Loading, PageHeader, Spinner, errorMessage } from '../../shared/ui';
import { useToast } from '../../shared/ui/Toast';
import { formatBytes, formatDate } from '../../shared/format';

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
  const input = useRef<HTMLInputElement>(null);
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
      <PageHeader title={t('files.title')} subtitle={t('files.subtitle')} actions={
        <>
          <input ref={input} type="file" hidden onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn primary" disabled={up.isPending} onClick={() => input.current?.click()}>{up.isPending ? <Spinner /> : <FileUp size={16} />} {t('files.upload')}</button>
        </>
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
                <td><Code>{f.checksum.slice(0, 16)}…</Code></td>
                <td>{f.referencedBy.length ? f.referencedBy.join(', ') : <span className="muted">—</span>}</td>
                <td>{formatDate(f.createdAt, lang)}</td>
                <td className="row gap">
                  <button className="btn small ghost" onClick={() => download(f).catch((e) => toast.error(errorMessage(e)))}><Download size={14} /></button>
                  <button className="btn small ghost danger" disabled={f.referencedBy.length > 0} title={f.referencedBy.length ? t('files.inUse') : ''} onClick={() => setDeleting(f)}><Trash2 size={14} /></button>
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
