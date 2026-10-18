import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { get } from '../../../services/client';
import type { WorkflowSummary } from '../../../types/api';
import { Button, ErrorAlert, Field, Loading, Select } from '../../../components/ui';
import { useI18n } from '../../../app/providers/I18nProvider';
import RunWorkflowModal from '../../workflows/RunWorkflowModal';

export default function WorkflowRunAction({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const workflows = useQuery({ queryKey: ['workflows'], queryFn: () => get<WorkflowSummary[]>('/workflows') });
  const [selected, setSelected] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const workflow = workflows.data?.find((item) => String(item.id) === selected);
  return (
    <div className="chatActionFields">
      {workflows.isLoading ? <Loading /> : workflows.error ? <ErrorAlert error={workflows.error} onRetry={() => workflows.refetch()} /> : !workflows.data?.length ? (
        <p className="muted small">{t('chatActions.noWorkflows')}</p>
      ) : (
        <>
          <Field label={t('chatActions.workflowLabel')} required>
            <Select name="workflowId" block placeholder={t('chatActions.chooseWorkflow')} value={selected} disabled={disabled}
              onChange={(event) => setSelected(event.target.value)}
              options={workflows.data.map((item) => ({ value: item.id, label: item.name }))} />
          </Field>
          <Button variant="primary" small icon={<Play size={14} />} disabled={!workflow || disabled}
            onClick={() => setReviewing(true)}>{t('chatActions.reviewRun')}</Button>
        </>
      )}
      {reviewing && workflow && <RunWorkflowModal workflowId={workflow.id} name={workflow.name} onClose={() => setReviewing(false)} />}
    </div>
  );
}
