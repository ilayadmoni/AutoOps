package com.autoops.workflow.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.service.ExecutionService;
import com.autoops.workflow.entity.Workflow;
import org.springframework.stereotype.Service;

import java.util.Map;

/** Workflow runs go through the same execution engine, history, preflight and approval policy as command runs. */
@Service
public class WorkflowRunService {
    private final WorkflowService workflows;
    private final WorkflowPlanBuilder plans;
    private final ExecutionService executions;
    private final AuditService audit;

    public WorkflowRunService(WorkflowService workflows, WorkflowPlanBuilder plans, ExecutionService executions, AuditService audit) {
        this.workflows = workflows;
        this.plans = plans;
        this.executions = executions;
        this.audit = audit;
    }

    public ExecutionDtos.Detail run(AuthenticatedUser user, Long workflowId, ExecutionDtos.RunOptions options) {
        Workflow w = workflows.requireOwned(user.id(), workflowId);
        var plan = plans.plan(w.getId());
        // Resolving every step fails fast on unapproved commands, invalid parameters or unavailable files.
        String risk = executions.planRisk(plan, user.id());
        audit.record(user.id(), "WORKFLOW_RUN_REQUESTED", "WORKFLOW", w.getId(), Map.of("name", w.getName(), "risk", risk));
        return executions.create(user, "WORKFLOW", w.getName(), null, w.getId(), null, false, risk, options);
    }
}
