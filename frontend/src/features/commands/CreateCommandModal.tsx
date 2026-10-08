import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '../../lib/apiClient';
import type { ParamType, ParameterSpec } from '../../types/api';
import { Button, Checkbox, Code, ErrorAlert, Field, Modal, Select, TextInput, Textarea } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/queryKeys';
import { commandsService } from '../../services/commands';

const PARAM_TYPES: ParamType[] = ['STRING', 'INTEGER', 'PATH', 'SERVICE', 'PACKAGE', 'HOSTNAME', 'ENUM'];
const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]{0,63})\s*}}/g;

export default function CreateCommandModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', category: 'SYSTEM', commandTemplate: '' });
  const [params, setParams] = useState<ParameterSpec[]>([]);
  useEffect(() => {
    const names = [...new Set([...form.commandTemplate.matchAll(PLACEHOLDER)].map((m) => m[1]))];
    setParams((old) => names.map((n) => old.find((p) => p.name === n) ?? { name: n, label: n, type: 'STRING', required: true }));
  }, [form.commandTemplate]);
  const save = useMutation({
    mutationFn: () => commandsService.create({ ...form, parameters: params }),
    onSuccess: (c) => {
      toast.success(c.status === 'APPROVED' ? t('commands.createdApproved') : t('commands.createdPending'));
      qc.invalidateQueries({ queryKey: queryKeys.commands.all });
      onClose();
    },
  });
  const fe = (save.error as ApiError | null)?.fieldErrors ?? {};
  const setParam = (i: number, patch: Partial<ParameterSpec>) => setParams((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return (
    <Modal wide title={t('commands.create')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted small">{t('commands.createHint')}</p>
        <ErrorAlert error={save.error} />
        <div className="fieldRow">
          <Field label={t('common.name')} error={fe.name} required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} /></Field>
          <Field label={t('commands.category')}><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={80} /></Field>
        </div>
        <Field label={t('common.description')}><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} /></Field>
        <Field label={t('commands.template')} error={fe.commandTemplate} hint={t('commands.templateHint')} required>
          <TextInput dir="ltr" className="mono" value={form.commandTemplate} onChange={(e) => setForm({ ...form, commandTemplate: e.target.value })} required placeholder="systemctl status {{service}}" />
        </Field>
        {params.length > 0 && (
          <table className="table">
            <thead><tr><th>{t('common.name')}</th><th>{t('params.label')}</th><th>{t('params.typeLabel')}</th><th>{t('params.required')}</th><th>{t('params.allowed')}</th></tr></thead>
            <tbody>
              {params.map((p, i) => (
                <tr key={p.name}>
                  <td><Code>{p.name}</Code></td>
                  <td><TextInput aria-label={t('params.label')} value={p.label ?? ''} onChange={(e) => setParam(i, { label: e.target.value })} /></td>
                  <td>
                    <Select
                      block aria-label={t('params.typeLabel')} value={p.type}
                      onChange={(e) => setParam(i, { type: e.target.value as ParamType })}
                      options={PARAM_TYPES.map((x) => ({ value: x, label: t('params.type.' + x) }))}
                    />
                  </td>
                  <td><Checkbox aria-label={t('params.required')} checked={p.required !== false} onChange={(e) => setParam(i, { required: e.target.checked })} /></td>
                  <td>{p.type === 'ENUM' && <TextInput dir="ltr" aria-label={t('params.allowed')} placeholder="a,b,c" value={(p.allowedValues ?? []).join(',')} onChange={(e) => setParam(i, { allowedValues: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {fe.parameters && <span className="fieldError">{fe.parameters}</span>}
        <div className="modalFooter inline">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>{t('commands.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
