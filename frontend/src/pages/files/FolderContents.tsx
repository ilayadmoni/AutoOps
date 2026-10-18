import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog, ErrorAlert, errorMessage, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { del, get } from '../../services/client';
import { useI18n } from '../../app/providers/I18nProvider';
import type { FolderEntry } from './folderPackage';
import FolderTree from './FolderTree';

export default function FolderContents({ id, canDelete }: { id: number; canDelete: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['folder-manifest', id], queryFn: () => get<FolderEntry[]>('/files/' + id + '/manifest'), enabled: open });
  const remove = useMutation({
    mutationFn: (path: string) => del('/files/' + id + '/folders?path=' + encodeURIComponent(path)),
    onSuccess: () => {
      toast.success(t('folders.subfolderDeleted'));
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ['files'] });
      void qc.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: error => toast.error(errorMessage(error)),
  });
  return <>
    <details className="folderContents" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('folders.contents')}</summary>
      {open && (q.isPending ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} />
        : <FolderTree entries={q.data} onDeleteFolder={canDelete ? setDeleting : undefined} />)}
    </details>
    {deleting && <ConfirmDialog danger title={t('folders.deleteSubfolderTitle')}
      message={t('folders.deleteSubfolderMessage', { name: deleting })} confirmLabel={t('common.delete')}
      busy={remove.isPending} onCancel={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting)} />}
  </>;
}
