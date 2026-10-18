import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorAlert, Loading } from '../../components/ui';
import { get } from '../../services/client';
import { useI18n } from '../../app/providers/I18nProvider';
import type { FolderEntry } from './folderPackage';
import FolderTree from './FolderTree';

export default function FolderContents({ id }: { id: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['folder-manifest', id], queryFn: () => get<FolderEntry[]>('/files/' + id + '/manifest'), enabled: open });
  return <details className="folderContents" onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary>{t('folders.contents')}</summary>
    {open && (q.isPending ? <Loading /> : q.error ? <ErrorAlert error={q.error} onRetry={() => q.refetch()} /> : <FolderTree entries={q.data} />)}
  </details>;
}
