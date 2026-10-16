import { FileUp, Folder } from 'lucide-react';
import type { StoredFile, WorkflowNode } from '../../../types/api';
import { Button, Checkbox, Field, FilePicker, Select, TextInput } from '../../../components/ui';
import { useI18n } from '../../../app/providers/I18nProvider';
import { useToast } from '../../../components/ui/Toast';
import { useUpload } from '../../../pages/files/FilesPage';
import FolderUpload from '../../../pages/files/FolderUpload';
type ConfigProps = { node: WorkflowNode; onChange: (patch: Partial<WorkflowNode>) => void; errors: Record<string, string> };
export function FileConfig({ node, onChange, files, errors }: ConfigProps & { files: StoredFile[] }) {
  const { t } = useI18n();
  const up = useUpload();
  const folder = !!files.find((f) => f.id === node.storedFileId)?.folderName;
  const toast = useToast();
  return (
    <>
      <Field label={t('folders.select')} error={errors.storedFileId}>
        <Select
          block placeholder={t('workflows.selectFile')}
          value={node.storedFileId ?? ''}
          onChange={(x) => onChange({ storedFileId: x.target.value ? Number(x.target.value) : null, overwrite: false })}
          options={files.map((f) => ({ value: f.id, label: `${f.folderName ? t('folders.package') + ": " + f.folderName : f.filename} (#${f.id} · ${f.checksum.slice(0, 8)})` }))}
        />
      </Field>
      <FilePicker onPick={(f) => {
        if (!f) return;
        up.mutate(f, {
          onSuccess: (saved) => { onChange({ storedFileId: saved.id, overwrite: false }); toast.success(t('files.uploaded', { name: saved.filename })); },
          onError: (err) => toast.error(err.message),
        });
      }}>
        {(open) => <Button small busy={up.isPending} icon={<FileUp size={14} />} onClick={open}>{t('files.upload')}</Button>}
      </FilePicker>
      <FolderUpload onUploaded={(saved) => onChange({ storedFileId: saved.id, overwrite: false })}>
        {(open) => <Button small icon={<Folder size={14} />} onClick={open}>{t('folders.upload')}</Button>}
      </FolderUpload>
      <Field label={t(folder ? 'folders.destination' : 'workflows.destination')} error={errors.destinationPath} hint={t(folder ? 'folders.destinationHint' : 'workflows.destinationHint')}>
        <TextInput dir="ltr" value={node.destinationPath ?? ''} onChange={(x) => onChange({ destinationPath: x.target.value })} />
      </Field>
      {folder && <small className="muted">{t('folders.replaceHint')}</small>}
      <div className="row gap wrap">
        <Checkbox checked={!!node.overwrite} onChange={(x) => onChange({ overwrite: x.target.checked })} label={t(folder ? 'folders.replace' : 'workflows.overwrite')} />
        <Checkbox checked={!!node.useSudo} onChange={(x) => onChange({ useSudo: x.target.checked })} label={t('workflows.privileged')} />
      </div>
    </>
  );
}
