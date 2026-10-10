import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Preflight } from '../../types/api';
import { useI18n } from '../../app/providers/I18nProvider';
import { StatusBadge } from '../../components/ui';
import PipelineNode from './PipelineNode';
import { isTerminal } from '../../utils/format';

const CHECKS = ['parametersStatus', 'filesStatus', 'hostVerificationStatus', 'sshStatus', 'authenticationStatus', 'osStatus', 'sudoStatus'] as const;

export default function PreflightNode({ preflight, machineStatus }: { preflight?: Preflight | null; machineStatus: string }) {
  const { t } = useI18n();
  const status = preflight?.status ?? (['CANCELLED', 'SKIPPED'].includes(machineStatus)
    ? machineStatus : isTerminal(machineStatus) ? 'NOT_CHECKED' : 'PENDING');
  const [open, setOpen] = useState(status === 'FAILED');
  useEffect(() => { if (status === 'FAILED') setOpen(true); }, [status]);
  return (
    <PipelineNode status={status} name={t('preflight.title')} icon={ShieldCheck}
      subtitle={t('workflows.system')} open={open} onToggle={() => setOpen(!open)}>
      <div className="preflight">
        {CHECKS.map((key) => <div key={key} className="checkItem">
          <span>{t('preflight.' + key)}</span><StatusBadge status={preflight?.[key] ?? 'NOT_CHECKED'} />
        </div>)}
        {preflight?.failureReason && <small className="fieldError">{preflight.failureReason}</small>}
      </div>
    </PipelineNode>
  );
}
