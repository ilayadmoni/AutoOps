package com.autoops.execution.engine;

import com.autoops.execution.entity.*;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.execution.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Short, transactional state transitions used by the engine threads. Every visible state is persisted here. */
@Service
public class ExecutionStore {
    private final ExecutionRepository executions;
    private final MachineRunRepository machineRuns;
    private final PreflightRunRepository preflights;
    private final StepRunRepository steps;
    private final ApprovalRequestRepository approvals;

    public ExecutionStore(ExecutionRepository executions, MachineRunRepository machineRuns, PreflightRunRepository preflights,
                          StepRunRepository steps, ApprovalRequestRepository approvals) {
        this.executions = executions;
        this.machineRuns = machineRuns;
        this.preflights = preflights;
        this.steps = steps;
        this.approvals = approvals;
    }

    @Transactional(readOnly = true)
    public Execution execution(Long id) {
        return executions.findById(id).orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<MachineRun> machineRuns(Long executionId) {
        return machineRuns.findByExecutionIdOrderByPositionAsc(executionId);
    }

    @Transactional(readOnly = true)
    public MachineRun machineRun(Long id) {
        return machineRuns.findById(id).orElseThrow();
    }

    @Transactional(readOnly = true)
    public StepRun stepRun(Long id) {
        return steps.findById(id).orElseThrow();
    }

    @Transactional
    public void markExecutionRunning(Long id) {
        Execution e = executions.findById(id).orElseThrow();
        e.setStatus(ExecutionStatus.RUNNING);
        if (e.getStartedAt() == null) {
            e.setStartedAt(Instant.now());
        }
        e.setFinishedAt(null);
        executions.save(e);
    }

    @Transactional
    public void setExecutionStatus(Long id, String status) {
        Execution e = executions.findById(id).orElseThrow();
        if (!ExecutionStatus.isTerminal(e.getStatus())) {
            e.setStatus(status);
            executions.save(e);
        }
    }

    /** Returns to RUNNING after an approval wait unless other approvals of this execution are still pending. */
    @Transactional
    public void resumeAfterApproval(Long id) {
        if (approvals.findByExecutionIdAndStatus(id, ApprovalRequest.PENDING).isEmpty()) {
            setExecutionStatus(id, ExecutionStatus.RUNNING);
        }
    }

    @Transactional
    public void setExecutionFailureReason(Long id, String reason) {
        Execution e = executions.findById(id).orElseThrow();
        e.setFailureReason(truncate(reason, 2000));
        executions.save(e);
    }

    @Transactional
    public PreflightRun startPreflight(Long machineRunId) {
        MachineRun mr = machineRuns.findById(machineRunId).orElseThrow();
        mr.setStatus(ExecutionStatus.PREFLIGHT);
        mr.setStartedAt(Instant.now());
        machineRuns.save(mr);
        PreflightRun p = new PreflightRun();
        p.setMachineRunId(machineRunId);
        p.setStatus(ExecutionStatus.RUNNING);
        p.setStartedAt(Instant.now());
        return preflights.save(p);
    }

    @Transactional
    public PreflightRun savePreflight(PreflightRun p) {
        return preflights.save(p);
    }

    @Transactional
    public void setMachineStatus(Long machineRunId, String status) {
        MachineRun mr = machineRuns.findById(machineRunId).orElseThrow();
        if (!ExecutionStatus.isTerminal(mr.getStatus())) {
            mr.setStatus(status);
            if (mr.getStartedAt() == null) {
                mr.setStartedAt(Instant.now());
            }
            machineRuns.save(mr);
        }
    }

    /** Reopens a finished machine run for a retry. */
    @Transactional
    public void reopenMachine(Long machineRunId) {
        MachineRun mr = machineRuns.findById(machineRunId).orElseThrow();
        mr.setStatus(ExecutionStatus.RUNNING);
        mr.setFailureReason(null);
        mr.setFinishedAt(null);
        machineRuns.save(mr);
    }

    @Transactional
    public void finishMachine(Long machineRunId, String status, String reason) {
        MachineRun mr = machineRuns.findById(machineRunId).orElseThrow();
        mr.setStatus(status);
        mr.setFailureReason(truncate(reason, 2000));
        mr.setFinishedAt(Instant.now());
        machineRuns.save(mr);
    }

    @Transactional
    public StepRun createStep(Long machineRunId, PlanStep step, ResolvedStep resolved, String status, int attempt, Long retryOf) {
        StepRun s = new StepRun();
        s.setMachineRunId(machineRunId);
        s.setWorkflowStepId(step.workflowStepId());
        s.setStepKey(step.key());
        s.setStepName(step.name());
        s.setStepType(step.definition().type());
        s.setStatus(status);
        s.setAttemptNumber(attempt);
        s.setRetryOfStepRunId(retryOf);
        if (resolved != null) {
            s.setOriginalCommand(resolved.originalCommand());
            s.setResolvedCommand(resolved.resolvedCommand());
            s.setRiskLevel(resolved.riskLevel());
            s.setRunWithSudo(resolved.runWithSudo());
        }
        if (ExecutionStatus.RUNNING.equals(status)) {
            s.setStartedAt(Instant.now());
        }
        return steps.save(s);
    }

    @Transactional
    public StepRun markStepRunning(Long stepRunId, ResolvedStep resolved) {
        StepRun s = steps.findById(stepRunId).orElseThrow();
        s.setStatus(ExecutionStatus.RUNNING);
        s.setStartedAt(Instant.now());
        s.setOriginalCommand(resolved.originalCommand());
        s.setResolvedCommand(resolved.resolvedCommand());
        s.setRiskLevel(resolved.riskLevel());
        s.setRunWithSudo(resolved.runWithSudo());
        return steps.save(s);
    }

    @Transactional
    public StepRun finishStep(Long stepRunId, StepResult r) {
        StepRun s = steps.findById(stepRunId).orElseThrow();
        s.setStatus(r.status());
        s.setStdout(r.stdout());
        s.setStderr(r.stderr());
        s.setExitCode(r.exitCode());
        s.setFailureReason(truncate(r.failureReason(), 2000));
        if (s.getStartedAt() == null) {
            s.setStartedAt(Instant.now());
        }
        s.setFinishedAt(Instant.now());
        return steps.save(s);
    }

    @Transactional
    public ApprovalRequest createApproval(Long executionId, Long machineRunId, Long stepRunId, String scope, String risk, String reason) {
        ApprovalRequest a = new ApprovalRequest();
        a.setExecutionId(executionId);
        a.setMachineRunId(machineRunId);
        a.setStepRunId(stepRunId);
        a.setScope(scope);
        a.setRiskLevel(risk);
        a.setReason(reason);
        return approvals.save(a);
    }

    @Transactional(readOnly = true)
    public String approvalStatus(Long approvalId) {
        return approvals.findById(approvalId).map(ApprovalRequest::getStatus).orElse(ApprovalRequest.CANCELLED);
    }

    /** Closes an approval that nobody decided (cancelled execution or timeout). */
    @Transactional
    public void closeApproval(Long approvalId, String status) {
        approvals.findById(approvalId).ifPresent(a -> {
            if (ApprovalRequest.PENDING.equals(a.getStatus())) {
                a.setStatus(status);
                a.setDecidedAt(Instant.now());
                approvals.save(a);
            }
        });
    }

    /**
     * Computes the final execution status from its machine runs. Cancellation wins; otherwise all-success is SUCCESS,
     * a mix with at least one success is PARTIAL, and anything else is FAILED (or CANCELLED when nothing ran because a
     * human rejected or the run was stopped).
     */
    @Transactional
    public Execution finalizeExecution(Long executionId) {
        Execution e = executions.findById(executionId).orElseThrow();
        List<MachineRun> runs = machineRuns.findByExecutionIdOrderByPositionAsc(executionId);
        boolean cancelRequested = e.getCancelRequestedAt() != null;
        for (MachineRun mr : runs) {
            if (!ExecutionStatus.isTerminal(mr.getStatus())) {
                mr.setStatus(cancelRequested ? ExecutionStatus.CANCELLED : ExecutionStatus.FAILED);
                mr.setFailureReason(cancelRequested ? "Stopped by user" : "Did not complete");
                mr.setFinishedAt(Instant.now());
                machineRuns.save(mr);
            }
        }
        for (ApprovalRequest a : approvals.findByExecutionIdAndStatus(executionId, ApprovalRequest.PENDING)) {
            a.setStatus(ApprovalRequest.CANCELLED);
            a.setDecidedAt(Instant.now());
            approvals.save(a);
        }
        long success = runs.stream().filter(r -> ExecutionStatus.SUCCESS.equals(r.getStatus())).count();
        long failed = runs.stream().filter(r -> ExecutionStatus.FAILED.equals(r.getStatus())).count();
        long cancelled = runs.stream().filter(r -> ExecutionStatus.CANCELLED.equals(r.getStatus())).count();
        String status;
        if (cancelRequested) {
            status = ExecutionStatus.CANCELLED;
        } else if (!runs.isEmpty() && success == runs.size()) {
            status = ExecutionStatus.SUCCESS;
        } else if (success > 0) {
            status = ExecutionStatus.PARTIAL;
        } else if (failed == 0 && cancelled > 0) {
            status = ExecutionStatus.CANCELLED;
        } else {
            status = ExecutionStatus.FAILED;
        }
        e.setStatus(status);
        e.setFinishedAt(Instant.now());
        if (e.getStartedAt() == null) {
            e.setStartedAt(e.getFinishedAt());
        }
        if (e.getFailureReason() == null && !ExecutionStatus.SUCCESS.equals(status)) {
            e.setFailureReason(failed > 0 ? failed + " of " + runs.size() + " machine(s) failed" : null);
        }
        if (ExecutionStatus.SUCCESS.equals(status)) {
            e.setFailureReason(null);
        }
        return executions.save(e);
    }

    static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
