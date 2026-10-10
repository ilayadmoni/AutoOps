import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, get, post, put } from '../../../services/client';
import type { ValidationResult, WorkflowDraft, WorkflowView } from '../../../types/api';
import { useI18n } from '../../../app/providers/I18nProvider';
import { useToast } from '../../../components/ui/Toast';
import { cleanParams } from '../../commands/ParameterInputs';
import { fromFieldErrors, groupErrors, normalize } from '../../workflows/builder/model';
import type { Action, WorkspaceState } from './model';

/** The body the workflow API takes, built from the workspace draft. */
export const toSaveBody = (s: WorkspaceState): WorkflowDraft => ({
  name: s.name.trim() || 'Untitled workflow',
  description: s.description,
  nodes: s.nodes.map((n) => ({ ...n, parameters: n.parameters ? cleanParams(n.parameters) : n.parameters })),
  version: s.version ?? undefined,
});

class Invalid extends Error {}

/** Validate, save and execute for the workspace draft. Nothing here is reachable from an assistant reply. */
export function useWorkspaceActions(state: WorkspaceState, dispatch: (a: Action) => void) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const validate = useMutation({
    mutationFn: () => post<ValidationResult>('/workflows/validate', toSaveBody(state)),
    onSuccess: (r) => dispatch({ type: 'errors', errors: groupErrors(r.errors) }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = toSaveBody(state);
      const result = await post<ValidationResult>('/workflows/validate', body);
      if (!result.valid) { dispatch({ type: 'errors', errors: groupErrors(result.errors) }); throw new Invalid(); }
      return state.workflowId == null ? post<WorkflowView>('/workflows', body) : put<WorkflowView>('/workflows/' + state.workflowId, body);
    },
    onSuccess: (w) => {
      dispatch({ type: 'saved', id: w.id, version: w.version });
      toast.success(t('workflows.saved'));
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.setQueryData(['workflow', w.id], w);
    },
    onError: (e) => { if (e instanceof ApiError) dispatch({ type: 'errors', errors: fromFieldErrors(e.fieldErrors) }); },
  });

  /** Another session saved a newer version: take the stored one as the draft. */
  const reload = useMutation({
    mutationFn: () => get<WorkflowView>('/workflows/' + state.workflowId),
    onSuccess: (w) => {
      dispatch({ type: 'apply', proposal: { name: w.name, description: w.description ?? '', nodes: normalize(w.nodes), missing: [] } });
      dispatch({ type: 'saved', id: w.id, version: w.version });
      save.reset();
    },
  });

  const rejected = save.error instanceof Invalid;
  return {
    validate, save, reload, running, setRunning,
    stale: save.error instanceof ApiError && save.error.code === 'STALE_VERSION',
    saveError: save.error && !rejected && !(save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length) ? save.error : null,
  };
}
