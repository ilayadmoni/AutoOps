import { useI18n } from '../../../app/providers/I18nProvider';
import { Field, Select } from '../../../components/ui';
import type { ImportRow } from './types';
import { matchingCredentials, type ImportCredentials } from './useImportCredentials';

export default function ImportCredentialMatch({ row, credentials }: { row: ImportRow; credentials: ImportCredentials }) {
  const { t } = useI18n();
  const matches = matchingCredentials(row, credentials.query.data ?? []);
  if (!matches.length) return <small className="muted">{t('machineImport.noCredential')}</small>;
  if (matches.length === 1) return <small className="badge ok">{t('machineImport.autoCredential', { name: matches[0].name })}</small>;
  return <Field label={t('machineImport.existingCredential')} required hint={t('machineImport.ambiguousCredential')}>
    <Select block required name={`existing-credential-${row.index}`} value={credentials.ids[row.index] ?? ''}
      placeholder={t('machineImport.chooseCredential')}
      options={matches.map(credential => ({ value: credential.id, label: credential.name }))}
      onChange={event => credentials.choose(row.index, event.target.value ? Number(event.target.value) : undefined)} />
  </Field>;
}
