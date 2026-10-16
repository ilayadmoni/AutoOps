import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorAlert, Modal, errorMessage } from '../../components/ui';
import { useI18n } from '../../app/providers/I18nProvider';
import { useToast } from '../../components/ui/Toast';
import { get } from '../../services/client';
import type { StoredFile } from '../../types/api';
import { formatBytes } from '../../utils/format';
import FolderTree from './FolderTree';
import { selectFolder, uploadFolder, type FolderLimits, type FolderSelection } from './folderPackage';

export default function FolderUpload({ children, onUploaded }: {
  children: (open: () => void) => ReactNode; onUploaded?: (file: StoredFile) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<FolderSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executable, setExecutable] = useState(new Set<string>());
  const limits = useQuery({ queryKey: ['folder-limits'], queryFn: () => get<FolderLimits>('/files/folders/limits') });
  const up = useMutation({
    mutationFn: () => uploadFolder(selection!, [...executable]),
    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: ['files'] }); setSelection(null);
      toast.success(t('files.uploaded', { name: file.folderName ?? file.filename })); onUploaded?.(file);
    },
  });
  const total = selection?.files.reduce((size, file) => size + file.size, 0) ?? 0;
  const tooLarge = !!selection && !!limits.data && (selection.files.length > limits.data.maxFiles || total > limits.data.maxBytes);
  function pick(files: File[]) {
    up.reset(); setError(null); setExecutable(new Set());
    if (!files.length) return;
    try { setSelection(selectFolder(files)); }
    catch (e) { setError(t(errorMessage(e))); }
  }
  return <>
    <input hidden type="file" multiple aria-label={t('folders.upload')} ref={(el) => { input.current = el; el?.setAttribute('webkitdirectory', ''); }}
      onChange={(e) => { pick(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    {children(() => {
      if (input.current && 'webkitdirectory' in input.current) input.current.click();
      else toast.error(t('folders.unsupported'));
    })}
    {error && <ErrorAlert error={new Error(error)} />}
    {selection && <Modal wide title={t('folders.preview')} onClose={() => { if (!up.isPending) setSelection(null); }} footer={<>
      <Button variant="ghost" disabled={up.isPending} onClick={() => setSelection(null)}>{t('common.cancel')}</Button>
      <Button variant="primary" busy={up.isPending} disabled={tooLarge || !limits.data} onClick={() => up.mutate()}>{t('folders.confirm')}</Button>
    </>}>
      <h3 dir="ltr">{selection.name}</h3>
      <p>{t('folders.count', { n: selection.files.length })} · {formatBytes(total)}</p>
      <p className="muted">{t('folders.note')}</p>
      {limits.data && <small className="muted">{t('folders.limit', { n: limits.data.maxFiles, size: formatBytes(limits.data.maxBytes) })}</small>}
      <ErrorAlert error={limits.error} onRetry={() => limits.refetch()} />
      <ErrorAlert error={tooLarge ? new Error(t('folders.tooLarge')) : up.error} />
      <FolderTree entries={selection.paths.map((path, i) => ({ path, size: selection.files[i].size, checksum: '', executable: false }))}
        executable={executable} onToggle={(path, checked) => setExecutable((current) => {
          const next = new Set(current); if (checked) next.add(path); else next.delete(path); return next;
        })} />
    </Modal>}
  </>;
}
