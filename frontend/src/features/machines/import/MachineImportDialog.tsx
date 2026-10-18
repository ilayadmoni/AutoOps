import { Upload } from 'lucide-react';
import { useI18n } from '../../../app/providers/I18nProvider';
import { Button, Checkbox, ErrorAlert, Field, FilePicker, Loading, Modal, Select } from '../../../components/ui';
import ImportFolderGroups from './ImportFolderGroups';
import { revealInvalidCredential } from './sessionFolders';
import ImportResults from './ImportResults';
import { useMachineImport } from './useMachineImport';

export default function MachineImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const state = useMachineImport();
  const eligible = state.rows.filter(row => !row.skipReason);
  const close = () => { if (!state.busy) onClose(); };
  return <Modal wide title={t(state.result ? 'machineImport.done' : 'machineImport.title')} onClose={close}>
    <form className="stack machineImport" method="post" onSubmit={e => { e.preventDefault(); void state.submit(); }}
      onInvalidCapture={e => revealInvalidCredential(e.target)} aria-busy={state.busy}>
      <ErrorAlert error={state.error} />
      {state.result ? <ImportResults result={state.result} /> : <>
        <p className="muted">{t('machineImport.explain')}</p>
        <FilePicker accept=".mxtsessions" disabled={state.busy} onPick={file => void state.pick(file)}>
          {open => <div className="importFile">
            <Button icon={<Upload size={18} />} onClick={open} busy={state.busy}>{t(state.file ? 'machineImport.another' : 'machineImport.pick')}</Button>
            <small className="muted">{state.file?.name ?? t('machineImport.fileHint')}</small>
          </div>}
        </FilePicker>
        {!!state.rows.length && <>
          <p className="alert info">{t('machineImport.credentialsHint')}</p>
          <p className="muted">{t('machineImport.trustHint')}</p>
          <div className="row spread">
            <h3>{t('machineImport.preview')}</h3>
            <span role="status">{t('machineImport.selected', { selected: state.selected.size, total: state.rows.length })}</span>
          </div>
          <fieldset disabled={state.busy} className="importSelection">
            <legend className="srOnly">{t('machineImport.preview')}</legend>
            {!!state.credentials.query.data?.length && <Field label={t('machineImport.defaultCredential')} hint={t('machineImport.defaultCredentialHint')}>
              <Select block value={state.credentials.defaultId ?? ''} placeholder={t('machineImport.noDefaultCredential')}
                options={state.credentials.query.data.map(credential => ({ value: credential.id, label: credential.name, hint: credential.username }))}
                onChange={e => state.credentials.setDefaultId(e.target.value ? Number(e.target.value) : null)} />
            </Field>}
            <Checkbox checked={!!eligible.length && state.selected.size === eligible.length}
              indeterminate={state.selected.size > 0 && state.selected.size < eligible.length}
              disabled={!eligible.length} label={t('machineImport.selectAll')} onChange={e => state.toggleAll(e.target.checked)} />
            <ErrorAlert error={state.credentials.query.error} onRetry={() => state.credentials.query.refetch()} />
            {state.credentials.query.isPending ? <Loading /> : <ImportFolderGroups credentials={state.credentials} rows={state.rows} selected={state.selected} drafts={state.drafts}
              onToggle={state.toggle} onCredential={state.credential} onSelectFolder={state.selectGroup} />}
          </fieldset>
        </>}
      </>}
      <div className="modalFooter inline">
        {state.result && <Button onClick={state.reset}>{t('machineImport.another')}</Button>}
        <span className="grow" />
        <Button disabled={state.busy} onClick={close}>{t(state.result ? 'common.close' : 'common.cancel')}</Button>
        {!state.result && !!state.rows.length && <Button type="submit" variant="primary" busy={state.busy} disabled={!state.credentials.query.data || state.credentials.query.isError}>
          {t('machineImport.import', { n: state.selected.size })}
        </Button>}
      </div>
    </form>
  </Modal>;
}
