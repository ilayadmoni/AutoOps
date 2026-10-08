import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { Command } from '../../types/api';
import { Button, Modal, Textarea, errorMessage } from '../../components';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';
import { adminService } from '../../services/admin';

export default function RejectCommandModal({ command, onClose, onRejected }: { command: Command; onClose: () => void; onRejected: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const reject = useMutation({
    mutationFn: () => adminService.rejectCommand(command.id, reason),
    onSuccess: () => { toast.success(t('cmdApprovals.rejected')); onRejected(); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal title={t('cmdApprovals.rejectTitle', { name: command.name })} onClose={onClose} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="danger" busy={reject.isPending} onClick={() => reject.mutate()}>{t('approvals.reject')}</Button>
      </>
    }>
      <Textarea aria-label={t('cmdApprovals.reason')} placeholder={t('cmdApprovals.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
    </Modal>
  );
}
