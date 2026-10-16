import { useI18n } from '../../../app/providers/I18nProvider';
import { Checkbox, Code } from '../../../components/ui';
import ImportCredential from './ImportCredential';
import type { CredentialDraft, ImportRow } from './types';

export default function ImportSessionRow({ row, selected, draft, onToggle, onCredential }: {
  row: ImportRow; selected: boolean; draft?: CredentialDraft;
  onToggle: () => void; onCredential: (value?: CredentialDraft) => void;
}) {
  const { t } = useI18n();
  return <li className={'importSession' + (row.skipReason ? ' skipped' : '')}>
    <div className="row spread">
      <Checkbox checked={selected} disabled={!!row.skipReason} onChange={onToggle} name={`session-${row.index}`}
        label={<strong>{row.name}</strong>} />
      <span className={'badge ' + (row.skipReason ? 'warn' : 'ok')}>{row.protocol}</span>
    </div>
    <div className="importSessionMeta">
      <Code>{row.hostname}:{row.sshPort}</Code>
      <small className="muted"><bdi dir="ltr">{row.folderPath || t('machineFolders.root')}</bdi></small>
      {row.username && <small className="muted">{t('machineImport.username')}: <bdi dir="ltr">{row.username}</bdi></small>}
    </div>
    {row.skipReason ? <small className="muted">{t('machineImport.reason.' + row.skipReason)}</small> : <>
      {row.warnings.map(warning => <p className="importWarning" key={warning}>{t('machineImport.warning.' + warning)}</p>)}
      {selected && <Checkbox checked={!!draft} name={`credential-${row.index}`} label={t('machineImport.addCredential')}
        onChange={e => onCredential(e.target.checked ? { name: `MobaXterm: ${row.name}`.slice(0, 150), username: row.username, password: '' } : undefined)} />}
      {selected && draft && <ImportCredential value={draft} onChange={onCredential} />}
      {selected && !draft && <small className="muted">{t('machineImport.noCredential')}</small>}
    </>}
  </li>;
}
