import type { ParameterSpec } from '../../shared/api/types';
import { Field, Select, TextInput } from '../../shared/ui';
import { useI18n } from '../../i18n/I18nProvider';

/** Renders inputs from a command's parameter schema. Values are validated again by the server. */
export function ParameterInputs({ specs, values, onChange, errors, prefix = '' }: {
  specs: ParameterSpec[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void;
  errors?: Record<string, string>; prefix?: string;
}) {
  const { t } = useI18n();
  if (!specs.length) return <p className="muted small">{t('params.none')}</p>;
  return (
    <div className="fieldRow">
      {specs.map((p) => {
        const err = errors?.[prefix + p.name];
        const set = (v: string) => onChange({ ...values, [p.name]: v });
        const label = <>{p.label || p.name} <small className="muted">{t('params.type.' + (p.type ?? 'STRING'))}</small></>;
        return (
          <Field key={p.name} label={label} error={err} hint={p.description} required={p.required !== false}>
            {p.type === 'ENUM' ? (
              <Select
                block placeholder={t('params.choose')}
                value={values[p.name] ?? ''}
                onChange={(e) => set(e.target.value)}
                options={(p.allowedValues ?? []).map((v) => ({ value: v, label: v }))}
              />
            ) : (
              <TextInput
                dir="ltr" value={values[p.name] ?? ''} placeholder={p.defaultValue ?? ''}
                inputMode={p.type === 'INTEGER' ? 'numeric' : undefined}
                onChange={(e) => set(e.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

/** Drops empty values so server-side defaults apply. */
export function cleanParams(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
}
