package com.autoops.workflow.service;

import com.autoops.common.error.ApiException;
import com.autoops.execution.plan.ExecutionPlan;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.StepDefinition;
import com.autoops.workflow.entity.*;
import com.autoops.workflow.repository.WorkflowStepRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Converts persisted typed workflow steps into an execution plan for the central engine. */
@Component
public class WorkflowPlanBuilder {
    private final WorkflowStepRepository steps;
    private final WorkflowService workflows;

    public WorkflowPlanBuilder(WorkflowStepRepository steps, WorkflowService workflows) {
        this.steps = steps;
        this.workflows = workflows;
    }

    @Transactional(readOnly = true)
    public ExecutionPlan plan(Long workflowId) {
        List<WorkflowStep> list = steps.findByWorkflowIdAndRetiredAtIsNullOrderByPositionAsc(workflowId);
        if (list.isEmpty()) {
            throw ApiException.validation("Workflow has no steps");
        }
        Map<Long, String> keys = new HashMap<>();
        list.forEach(s -> keys.put(s.getId(), s.getStepKey()));
        List<PlanStep> plan = list.stream().map(s -> new PlanStep(s.getStepKey(), s.getId(), s.getName(), s.isRequiresApproval(),
                definition(s), keys.get(s.getSuccessNextStepId()), keys.get(s.getFailureNextStepId()))).toList();
        return new ExecutionPlan(plan, list.get(0).getStepKey());
    }

    private StepDefinition definition(WorkflowStep s) {
        return switch (s) {
            case CommandStep c -> new StepDefinition.Command(c.getCommandDefinitionId(), workflows.read(c.getParameters()), c.isRunWithSudo(), c.getTimeoutSeconds());
            case FileTransferStep f -> new StepDefinition.FileTransfer(f.getStoredFileId(), f.getDestinationPath(), f.isOverwrite(), f.isUseSudo(), f.getTimeoutSeconds());
            case WaitUntilStep w -> new StepDefinition.WaitUntil(w.getCheckType(), w.getCommandDefinitionId(), workflows.read(w.getParameters()),
                    w.getExpectedOutput(), w.getExpectedExitCode(), w.getTarget(), w.isRunWithSudo(), w.getCheckIntervalSeconds(), w.getTimeoutSeconds());
            default -> throw new IllegalStateException("Unsupported step");
        };
    }
}
