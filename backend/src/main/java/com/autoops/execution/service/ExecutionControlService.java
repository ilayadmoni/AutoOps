package com.autoops.execution.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.engine.ExecutionEngine;
import com.autoops.execution.engine.ExecutionRuntime;
import com.autoops.execution.engine.ExecutionStore;
import com.autoops.execution.entity.*;
import com.autoops.execution.realtime.ExecutionEventPublisher;
import com.autoops.execution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Stop and Retry, both backed by real engine behaviour. */
@Service
public class ExecutionControlService {
    private final ExecutionRepository executions;
    private final MachineRunRepository machineRuns;
    private final StepRunRepository steps;
    private final ApprovalRequestRepository approvals;
    private final ExecutionQueryService queries;
    private final ExecutionRuntime runtime;
    private final ExecutionEngine engine;
    private final ExecutionStore store;
    private final ExecutionEventPublisher events;
    private final AuditService audit;
    private final TransactionTemplate tx;

    public ExecutionControlService(ExecutionRepository executions, MachineRunRepository machineRuns, StepRunRepository steps,
                                   ApprovalRequestRepository approvals, ExecutionQueryService queries, ExecutionRuntime runtime,
                                   ExecutionEngine engine, ExecutionStore store, ExecutionEventPublisher events, AuditService audit,
                                   TransactionTemplate tx) {
        this.executions = executions;
        this.machineRuns = machineRuns;
        this.steps = steps;
        this.approvals = approvals;
        this.queries = queries;
        this.runtime = runtime;
        this.engine = engine;
        this.store = store;
        this.events = events;
        this.audit = audit;
        this.tx = tx;
    }

    /**
     * Persists the cancellation request, stops all further scheduling, releases pending approvals and lets the
     * currently running remote operation (if any) finish; the engine then records a deterministic CANCELLED state.
     */
    public ExecutionDtos.Detail stop(AuthenticatedUser user, Long id) {
        Execution e = queries.requireVisible(user, id);
        if (!user.id().equals(e.getStartedBy()) && !user.isAdmin()) {
            throw ApiException.notFound("Execution");
        }
        if (ExecutionStatus.isTerminal(e.getStatus())) {
            throw ApiException.conflict("EXECUTION_FINISHED", "Execution has already finished");
        }
        tx.executeWithoutResult(s -> {
            Execution x = executions.findById(id).orElseThrow();
            if (x.getCancelRequestedAt() == null) {
                x.setCancelRequestedAt(Instant.now());
                executions.save(x);
            }
        });
        boolean active = runtime.cancel(id);
        events.publish(id, "CANCELLATION_REQUESTED", Map.of("requestedBy", user.id()));
        audit.record(user.id(), "EXECUTION_STOP_REQUESTED", "EXECUTION", id, Map.of());
        if (!active) {
            // Nothing is running this execution any more (e.g. after a restart): finalize directly.
            store.finalizeExecution(id);
            events.publish(id, "EXECUTION_CANCELLED", Map.of("status", ExecutionStatus.CANCELLED));
        }
        return queries.detail(user, id);
    }

    /**
     * Creates a new attempt linked to the failed step and executes it through the engine with the same authoritative
     * step definition (re-resolved server-side), continuing the plan from that step.
     */
    public ExecutionDtos.Detail retry(AuthenticatedUser user, Long stepRunId, boolean highRiskAcknowledged) {
        StepRun failed = steps.findById(stepRunId).orElseThrow(() -> ApiException.notFound("Step run"));
        MachineRun mr = machineRuns.findById(failed.getMachineRunId()).orElseThrow(() -> ApiException.notFound("Step run"));
        Execution e = executions.findById(mr.getExecutionId()).orElseThrow(() -> ApiException.notFound("Step run"));
        if (!user.id().equals(e.getStartedBy())) {
            throw ApiException.notFound("Step run");
        }
        if (!ExecutionStatus.FAILED.equals(failed.getStatus()) || steps.existsByRetryOfStepRunId(stepRunId)) {
            throw ApiException.conflict("NOT_RETRYABLE", "Only the latest failed attempt of a step can be retried");
        }
        if ("HIGH".equals(failed.getRiskLevel()) && !highRiskAcknowledged) {
            throw ApiException.validation("High-risk step: acknowledge the risk to retry", Map.of("highRiskAcknowledged", "Required"));
        }
        List<StepRun> machineSteps = steps.findByMachineRunIdOrderByIdAsc(mr.getId());
        if (machineSteps.isEmpty() || !machineSteps.get(machineSteps.size() - 1).getId().equals(stepRunId)) {
            throw ApiException.conflict("NOT_RETRYABLE", "Only the last step of a machine run can be retried");
        }
        Long newStepId = tx.execute(s -> {
            Execution x = executions.findById(e.getId()).orElseThrow();
            if (!ExecutionStatus.FAILED.equals(x.getStatus()) && !ExecutionStatus.PARTIAL.equals(x.getStatus())) {
                throw ApiException.conflict("NOT_RETRYABLE", "Execution must be finished with failures to retry a step");
            }
            x.setStatus(ExecutionStatus.RUNNING);
            x.setFinishedAt(null);
            x.setFailureReason(null);
            executions.save(x);
            store.reopenMachine(mr.getId());
            StepRun n = new StepRun();
            n.setMachineRunId(mr.getId());
            n.setWorkflowStepId(failed.getWorkflowStepId());
            n.setStepKey(failed.getStepKey());
            n.setStepName(failed.getStepName());
            n.setStepType(failed.getStepType());
            n.setRiskLevel(failed.getRiskLevel());
            n.setRunWithSudo(failed.isRunWithSudo());
            n.setStatus(ExecutionStatus.PENDING);
            n.setAttemptNumber(failed.getAttemptNumber() + 1);
            n.setRetryOfStepRunId(failed.getId());
            n = steps.save(n);
            ApprovalRequest a = new ApprovalRequest();
            a.setExecutionId(x.getId());
            a.setMachineRunId(mr.getId());
            a.setStepRunId(n.getId());
            a.setScope("RETRY");
            a.setRiskLevel(failed.getRiskLevel() == null ? "LOW" : failed.getRiskLevel());
            a.setReason("Retry requested by user");
            a.setStatus(ApprovalRequest.APPROVED);
            a.setApprovedBy(user.id());
            a.setDecidedAt(Instant.now());
            a.setHighRiskAcknowledged(highRiskAcknowledged);
            approvals.save(a);
            return n.getId();
        });
        audit.record(user.id(), "EXECUTION_STEP_RETRIED", "EXECUTION", e.getId(), Map.of("stepRunId", stepRunId, "newStepRunId", newStepId));
        engine.resume(e.getId(), mr.getId(), newStepId);
        return queries.detail(user, e.getId());
    }
}
