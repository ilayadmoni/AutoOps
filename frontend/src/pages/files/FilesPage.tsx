import { useCollectionTools } from '../../features/collections/useCollectionTools';
import { CollectionToolbar, EditCollection, FavoritesEmpty, ItemControls } from '../../features/collections/CollectionControls';
import { useState } from 'react';
import FolderUpload from './FolderUpload';
import FolderContents from './FolderContents';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Folder, Trash2 } from 'lucide-react';
import { del, get, getAccessToken, upload } from '../../services/client';
import type { StoredFile } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import {
  Card, Code, ConfirmDialog, EmptyState, ErrorAlert, errorMessage, Fab, FilePicker, IconButton, Loading, NoMatches, PageHeader, SearchToolbar, useCollectionSearch,
} from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { formatBytes, formatDate } from '../../utils/format';
import { storedFileName } from '../../utils/storedFileName';

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
  const { query, setQuery, filtered: searched } = useCollectionSearch(q.data, (f) => [storedFileName(f), f.checksum, ...f.referencedBy]);
  const tools = useCollectionTools('files', q.data, item => !q.data?.find(file => file.id === item.id)?.referencedBy.length);
  const filtered = tools.filter(searched);
  const remove = useMutation({
    mutationFn: (id: number) => del('/files/' + id),
    onSuccess: () => { toast.success(t('files.deleted')); setDeleting(null); qc.invalidateQueries({ queryKey: ['files'] }); },
    onError: (e) => { toast.error(errorMessage(e)); setDeleting(null); },
  });
  const onPick = (file?: File) => file && up.mutate(file, { onSuccess: () => toast.success(t('files.uploaded', { name: file.name })) });
  return (
    <section>
      <PageHeader title={t('files.title')} subtitle={t('files.subtitle')} actions={<EditCollection tools={tools} />} />
      <FolderUpload>{(openFolder) => <FilePicker onPick={onPick}>
        {(open) => <Fab label={t('files.upload')} busy={up.isPending} items={[
          { key: 'file', label: t('folders.uploadFile'), icon: <FileText size={16} />, onSelect: open },
          { key: 'folder', label: t('folders.upload'), icon: <Folder size={16} />, onSelect: openFolder },
        ]} />}
      </FilePicker>}</FolderUpload>
      <ErrorAlert error={up.error} />
      {!!q.data?.length && <SearchToolbar value={query} onChange={setQuery} placeholder={t('files.searchPlaceholder')} />}
      <CollectionToolbar tools={tools} visible={filtered} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title={t('files.empty')} hint={t('files.emptyHint')} />
      ) : !filtered.length ? (
        tools.onlyFavorites && !query.trim() ? <FavoritesEmpty /> : <NoMatches title={t('files.noMatch')} hint={t('files.noMatchHint')} />
      ) : (
        <div className="cards">
          {filtered.map((f) => (
            <Card key={f.id}>
              <div className="row spread"><h2 dir="ltr" className="fileName cardTitle">{f.folderName ? <Folder size={16} className="muted" /> : <FileText size={16} className="muted" />} {storedFileName(f)}</h2><ItemControls tools={tools} item={f} /></div>
              <div><Code>{f.checksum.slice(0, 16)}</Code></div>
              {f.folderName && <><small className="muted">{t('folders.package')} · {t('folders.version', { id: f.id })} · {t('folders.count', { n: f.fileCount ?? 0 })}</small><FolderContents id={f.id} canDelete={!f.referencedBy.length} /></>}
              <small className="muted">{formatBytes(f.size)} · <bdi>{formatDate(f.createdAt, lang)}</bdi></small>
              <small className="muted">{t('files.usedBy')}: {f.referencedBy.length ? f.referencedBy.join(', ') : t('files.unused')}</small>
              <div className="cardFoot">
                <IconButton label={t('files.download')} onClick={() => download(f).catch((e) => toast.error(errorMessage(e)))}><Download size={14} /></IconButton>
                <span className="grow" />
                <IconButton danger label={t('common.delete')} disabled={f.referencedBy.length > 0} hint={f.referencedBy.length ? t('files.inUse') : undefined} onClick={() => setDeleting(f)}><Trash2 size={14} /></IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}
      {deleting && <ConfirmDialog danger title={t('files.deleteTitle')} message={t('files.deleteMessage', { name: storedFileName(deleting) })} confirmLabel={t('common.delete')}
        busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} />}
    </section>
  );
}
