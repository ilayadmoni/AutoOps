import { useState, type ReactNode } from 'react';
import Modal from './Modal';
import Button from './Button';
import Checkbox from './Toggle';
import { useI18n } from '../../i18n/I18nProvider';

/**
 * Confirmation gate. `acknowledge` adds a checkbox the operator must tick before the
 * action unlocks — used for high-risk executions, where a single misclick is not enough.
 */
export default function ConfirmDialog({
  title, message, confirmLabel, danger, busy, onConfirm, onCancel, acknowledge,
}: {
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  acknowledge?: string;
}) {
  const { t } = useI18n();
  const [ack, setAck] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>{t('common.cancel')}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            busy={busy}
            disabled={!!acknowledge && !ack}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div>{message}</div>
        {acknowledge && (
          <Checkbox danger checked={ack} onChange={(e) => setAck(e.target.checked)} label={acknowledge} />
        )}
      </div>
    </Modal>
  );
}
