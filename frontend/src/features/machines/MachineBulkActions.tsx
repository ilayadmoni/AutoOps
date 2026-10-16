import { Trash2 } from 'lucide-react';
import type { Machine } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { Button, ConfirmDialog } from '../../components/ui';
import type { useMachineSelection } from './useMachineSelection';
import '../../assets/styles/machine-selection.css';

export default function MachineBulkActions({ selection, visible }: {
  selection: ReturnType<typeof useMachineSelection>; visible: Machine[];
}) {
  const { t } = useI18n();
  return (
    <>
      {selection.active && (
        <div className="machineBulkToolbar">
          <Button small disabled={selection.busy || !visible.length} onClick={() => selection.selectVisible(visible, true)}>{t('machinesBulk.selectAll')}</Button>
          <Button small disabled={selection.busy || !selection.selected.length} onClick={selection.clear}>{t('machinesBulk.clear')}</Button>
          <span className="muted small" role="status">{t('machinesBulk.selected', { n: selection.selected.length })}</span>
          <div className="row gap wrap">
            <Button small variant="danger" icon={<Trash2 size={14} />} busy={selection.busy} disabled={!selection.selected.length}
              onClick={selection.review}>{t('machinesBulk.deleteSelected', { n: selection.selected.length })}</Button>
          </div>
        </div>
      )}
      {selection.failures.length > 0 && <div className="alert danger" role="alert"><div>
        <strong>{t('machinesBulk.failed', { n: selection.failures.length })}</strong>
        <ul>{selection.failures.map(({ machine, message }) => <li key={machine.id}><bdi>{machine.name}</bdi>: <bdi dir="auto">{message}</bdi></li>)}</ul>
      </div></div>}
      {selection.targets && <ConfirmDialog danger title={t('machinesBulk.confirmTitle', { n: selection.targets.length })}
        message={<div className="stack">
          <p>{t('machinesBulk.confirmMessage')}</p>
          <ul className="machineDeleteList">{selection.targets.map(machine => <li key={machine.id}>
            <strong dir="auto">{machine.name}</strong> <bdi dir="ltr">{machine.hostname}:{machine.sshPort}</bdi>
          </li>)}</ul>
        </div>}
        confirmLabel={t('machinesBulk.deleteSelected', { n: selection.targets.length })} busy={selection.busy}
        onCancel={selection.cancel} onConfirm={selection.confirm} />}
    </>
  );
}
