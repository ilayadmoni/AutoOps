import { Play } from 'lucide-react';
import type { Command } from '../../types/api';
import { Button, Code, Modal, RiskBadge, StatusBadge } from '../../components';
import { useI18n } from '../../hooks/useI18n';

export default function CommandDetailModal({ command, onRun, onClose }: { command: Command; onRun: () => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={command.name} onClose={onClose} footer={
      <Button variant="primary" icon={<Play size={14} />} disabled={command.status !== 'APPROVED'} onClick={onRun}>{t('commands.run')}</Button>
    }>
      <div className="stack">
        <div className="row gap wrap"><RiskBadge risk={command.riskLevel} /><StatusBadge status={command.status} /><span className="badge muted">{t('source.' + command.source, undefined, command.source)}</span></div>
        {command.description && <p>{command.description}</p>}
        <Code>{command.commandTemplate}</Code>
        {command.rejectionReason && <div className="alert danger">{t('commands.rejectedBecause')}: {command.rejectionReason}</div>}
        {command.status === 'PENDING' && <div className="alert warn">{t('commands.pendingNote')}</div>}
        <h3>{t('commands.parameters')}</h3>
        {command.parameters.length === 0 ? <p className="muted">{t('params.none')}</p> : (
          <table className="table">
            <thead><tr><th>{t('common.name')}</th><th>{t('params.typeLabel')}</th><th>{t('params.required')}</th><th>{t('common.description')}</th></tr></thead>
            <tbody>{command.parameters.map((p) => <tr key={p.name}><td><Code>{p.name}</Code></td><td>{t('params.type.' + (p.type ?? 'STRING'))}</td><td>{p.required !== false ? '✓' : ''}</td><td>{p.description}{p.allowedValues?.length ? ' [' + p.allowedValues.join(', ') + ']' : ''}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}
