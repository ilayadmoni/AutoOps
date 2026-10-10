import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { AIOperation, Command, WorkflowNode } from '../../types/api';
import { post } from '../../services/client';
import { useI18n } from '../../app/providers/I18nProvider';
import { errorMessage } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { setAiDraft } from '../workflows/draftStore';
import type { RunCommandInitial } from '../commands/RunCommandModal';
import type { ProposalActions } from './ChatMessage';

export function useProposalActions(submit: (text: string) => void, pending: boolean) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [runInitial, setRunInitial] = useState<RunCommandInitial | null>(null);
  const [machineOp, setMachineOp] = useState<AIOperation | null>(null);
  const [added, setAdded] = useState<Set<AIOperation>>(() => new Set());
  const markAdded = (op: AIOperation) => setAdded((items) => new Set(items).add(op));
  const addCommand = useMutation({
    mutationFn: (op: AIOperation) => {
      const p = op.payload as { name: string; description?: string; category?: string; commandTemplate: string; parameters?: unknown[] };
      return post<Command>('/commands', {
        name: p.name, description: p.description, category: p.category, commandTemplate: p.commandTemplate, parameters: p.parameters ?? [],
      });
    },
    onSuccess: (command, op) => {
      markAdded(op); toast.success(command.status === 'APPROVED' ? t('ai.commandAddedApproved') : t('ai.commandAddedPending'));
      qc.invalidateQueries({ queryKey: ['commands'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const reviewWorkflow = (op: AIOperation) => {
    const p = op.payload as { name?: string; description?: string; nodes?: WorkflowNode[] };
    setAiDraft({ name: p.name ?? 'AI draft', description: p.description ?? '', nodes: p.nodes ?? [] });
    nav('/workflows/new');
  };
  const actions: ProposalActions = {
    onWorkflow: reviewWorkflow,
    onRun: (op) => {
      const p = op.payload as { commandDefinitionId: number; machineIds?: number[]; parameters?: Record<string, string>; runWithSudo?: boolean };
      setRunInitial({ commandId: p.commandDefinitionId, machineIds: p.machineIds ?? [], parameters: p.parameters ?? {}, runWithSudo: p.runWithSudo });
    },
    onAddCommand: (op) => addCommand.mutate(op), onAddMachine: setMachineOp,
    isAdded: (op) => added.has(op), isAdding: (op) => addCommand.isPending && addCommand.variables === op,
    onAnswer: submit, answering: pending,
  };
  return { actions, reviewWorkflow, runInitial, setRunInitial, machineOp, setMachineOp, markAdded };
}
