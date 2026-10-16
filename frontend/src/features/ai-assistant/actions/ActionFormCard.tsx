import { ShieldCheck } from 'lucide-react';
import type { AIOperation } from '../../../types/api';
import { useI18n } from '../../../app/providers/I18nProvider';
import WorkflowRunAction from './WorkflowRunAction';
import CredentialAction from './CredentialAction';

/** AI output selects a fixed UI capability. It cannot choose endpoints or provide secret field values. */
export default function ActionFormCard({ op, disabled }: { op: AIOperation; disabled: boolean }) {
  const { t } = useI18n();
  const action = op.payload.action;
  if (!['RUN_WORKFLOW', 'ADD_CREDENTIAL'].includes(String(action))) return null;
  return (
    <div className="proposal">
      <div className="proposalHead"><ShieldCheck aria-hidden="true" /><span>{t('ai.proposalNote')}</span></div>
      <div className="proposalBody">
        {action === 'RUN_WORKFLOW' && <WorkflowRunAction disabled={disabled} />}
        {action === 'ADD_CREDENTIAL' && <CredentialAction payload={op.payload} disabled={disabled} />}
      </div>
    </div>
  );
}
