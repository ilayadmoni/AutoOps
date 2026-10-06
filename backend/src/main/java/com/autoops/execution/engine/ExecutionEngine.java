package com.autoops.execution.engine;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.credential.entity.Credential;
import com.autoops.credential.repository.CredentialRepository;
import com.autoops.execution.entity.ApprovalRequest;
import com.autoops.execution.entity.Execution;
import com.autoops.execution.entity.ExecutionStatus;
import com.autoops.execution.entity.MachineRun;
import com.autoops.execution.entity.StepRun;
import com.autoops.execution.plan.ExecutionPlan;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.execution.plan.StepResolver;
import com.autoops.execution.realtime.ExecutionEventPublisher;
import com.autoops.infrastructure.remote.OutputListener;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;

/**
 * The single execution path for commands and workflows.
 *
 * <ol>
 *   <li>Preflight every machine (hard gate) with at most {@code concurrency} machines in flight.</li>
 *   <li>Gate the first real operation with a persisted approval when policy requires it
 *       (MANUAL: always; AUTOMATIC: HIGH risk only).</li>
 *   <li>Run each machine's plan with at most {@code concurrency} machines in flight, honouring the failure policy
 *       (STOP_NEW_MACHINES or CONTINUE) and Stop requests at every step boundary.</li>
 *   <li>Aggregate a deterministic final status.</li>
 * </ol>
 */
@Service
public class ExecutionEngine {
    private static final Logger log = LoggerFactory.getLogger(ExecutionEngine.class);
    private static final int MAX_STREAMED_BYTES_PER_STEP = 64 * 1024;

    private final ExecutionStore store;
    private final ExecutionRuntime runtime;
    private final ExecutionPlanFactory plans;
    private final PreflightRunner preflight;
    private final StepResolver resolver;
    private final StepRunner steps;
    private final MachineRepository machines;
    private final CredentialRepository credentials;
    private final ExecutionEventPublisher events;
    private final AuditService audit;
    private final ExecutorService coordinators;
    private final ExecutorService machinePool;
    private final Duration approvalTimeout;
    /** Set when the server stops: running threads are interrupted and must not record misleading final states. */
    private volatile boolean shuttingDown;

    public ExecutionEngine(ExecutionStore store, ExecutionRuntime runtime, ExecutionPlanFactory plans, PreflightRunner preflight,
                           StepResolver resolver, StepRunner steps, MachineRepository machines, CredentialRepository credentials,
                           ExecutionEventPublisher events, AuditService audit,
                           @Qualifier("executionCoordinatorPool") ExecutorService coordinators,
                           @Qualifier("executionMachinePool") ExecutorService machinePool,
                           @Value("${autoops.execution.approval-timeout-minutes:1440}") long approvalTimeoutMinutes) {
        this.store = store;
        this.runtime = runtime;
        this.plans = plans;
        this.preflight = preflight;
        this.resolver = resolver;
        this.steps = steps;
        this.machines = machines;
        this.credentials = credentials;
        this.events = events;
        this.audit = audit;
        this.coordinators = coordinators;
        this.machinePool = machinePool;
        this.approvalTimeout = Duration.ofMinutes(Math.max(1, approvalTimeoutMinutes));
    }

    /** In-flight work is closed by ExecutionRecovery on the next start ("Interrupted by server restart"). */
    @PreDestroy
    void shutdown() {
        shuttingDown = true;
    }

    /** Starts the asynchronous run of a persisted PENDING execution. */
    public void launch(Long executionId) {
        runtime.register(executionId);
        submit(executionId, () -> run(executionId));
    }

    /** Re-executes a retry StepRun (already persisted as PENDING) and continues the plan from that step. */
    public void resume(Long executionId, Long machineRunId, Long stepRunId) {
        runtime.register(executionId);
        submit(executionId, () -> runRetry(executionId, machineRunId, stepRunId));
    }

    private void submit(Long executionId, Runnable body) {
        try {
            coordinators.execute(() -> {
                try {
                    body.run();
                } catch (ShutdownInProgress ex) {
                    log.info("Execution {} left for restart recovery", executionId);
                } catch (Exception ex) {
                    if (shuttingDown) {
                        return;
                    }
                    log.error("Execution {} crashed", executionId, ex);
                    store.setExecutionFailureReason(executionId, "Internal engine error");
                    finish(executionId);
                } finally {
                    runtime.unregister(executionId);
                }
            });
        } catch (RejectedExecutionException ex) {
            runtime.unregister(executionId);
            store.setExecutionFailureReason(executionId, "Server is at capacity; execution was not started");
            store.finalizeExecution(executionId);
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "ENGINE_BUSY", "Too many executions are running. Try again shortly.");
        }
    }

    private void run(Long id) {
        Execution e = store.execution(id);
        if (e.getCancelRequestedAt() != null) {
            finish(id);
            return;
        }
        store.markExecutionRunning(id);
        events.publish(id, "EXECUTION_STARTED", Map.of("status", ExecutionStatus.RUNNING));
        ExecutionPlan plan = plans.build(e);
        List<MachineRun> runs = store.machineRuns(id);
        int limit = Math.max(1, Math.min(3, e.getConcurrency()));
        boolean stopOnFailure = "STOP_NEW_MACHINES".equals(e.getFailurePolicy());

        // Phase 1: preflight gate.
        Map<Long, Boolean> pre = bounded(id, runs, limit, false, mr -> preflight.run(e, plan, mr), "Not started: execution was stopped");
        List<MachineRun> passed = runs.stream().filter(mr -> Boolean.TRUE.equals(pre.get(mr.getId()))).toList();
        if (runtime.isCancelled(id)) {
            passed.forEach(mr -> store.finishMachine(mr.getId(), ExecutionStatus.CANCELLED, "Stopped by user"));
            finish(id);
            return;
        }
        if (passed.isEmpty()) {
            store.setExecutionFailureReason(id, "Preflight failed on every machine");
            finish(id);
            return;
        }
        if (passed.size() < runs.size() && stopOnFailure) {
            passed.forEach(mr -> skip(id, mr, "Not started: another machine failed preflight (failure policy STOP_NEW_MACHINES)"));
            store.setExecutionFailureReason(id, "Preflight failed on " + (runs.size() - passed.size()) + " machine(s)");
            finish(id);
            return;
        }

        // Phase 2: approval gate before the first real operation.
        boolean high = "HIGH".equals(e.getRiskLevel());
        if ("MANUAL".equals(e.getMode()) || high) {
            String reason = high ? "High-risk operation: explicit approval and acknowledgement required"
                    : "Manual mode: confirm to run on " + passed.size() + " machine(s)";
            ApprovalRequest a = store.createApproval(id, null, null, "EXECUTION", e.getRiskLevel(), reason);
            passed.forEach(mr -> store.setMachineStatus(mr.getId(), ExecutionStatus.WAITING_APPROVAL));
            store.setExecutionStatus(id, ExecutionStatus.WAITING_APPROVAL);
            events.publish(id, "APPROVAL_REQUIRED", Map.of("approvalId", a.getId(), "scope", "EXECUTION", "riskLevel", e.getRiskLevel()));
            ExecutionRuntime.Decision d = runtime.await(id, a.getId(), approvalTimeout, () -> store.approvalStatus(a.getId()));
            checkShutdown();
            if (d != ExecutionRuntime.Decision.APPROVED) {
                closeUndecided(a.getId(), d);
                String why = switch (d) {
                    case REJECTED -> "Approval rejected";
                    case EXPIRED -> "Approval expired";
                    default -> "Stopped by user";
                };
                passed.forEach(mr -> store.finishMachine(mr.getId(), ExecutionStatus.CANCELLED, why));
                store.setExecutionFailureReason(id, why);
                events.publish(id, d == ExecutionRuntime.Decision.REJECTED ? "REJECTED" : "APPROVAL_CLOSED", Map.of("approvalId", a.getId(), "decision", d.name()));
                finish(id);
                return;
            }
            store.setExecutionStatus(id, ExecutionStatus.RUNNING);
            events.publish(id, "APPROVED", Map.of("approvalId", a.getId()));
        }

        // Phase 3: run, bounded by per-execution concurrency and the failure policy.
        bounded(id, passed, limit, stopOnFailure, mr -> runMachine(e, plan, mr, plan.entry(), null),
                "Not started: another machine failed (failure policy STOP_NEW_MACHINES)");
        finish(id);
    }

    /**
     * Runs {@code job} for each machine run with at most {@code limit} in flight. When stopOnFailure is set, no new
     * machine is scheduled after a failure. Machines never scheduled are marked SKIPPED (or CANCELLED after Stop).
     */
    private Map<Long, Boolean> bounded(Long executionId, List<MachineRun> runs, int limit, boolean stopOnFailure,
                                       Function<MachineRun, Boolean> job, String skipReason) {
        Map<Long, Boolean> results = new ConcurrentHashMap<>();
        CompletionService<Map.Entry<Long, Boolean>> cs = new ExecutorCompletionService<>(machinePool);
        Iterator<MachineRun> it = runs.iterator();
        int active = 0;
        boolean stop = false;
        while (true) {
            while (active < limit && it.hasNext() && !stop && !runtime.isCancelled(executionId)) {
                MachineRun mr = it.next();
                cs.submit(() -> {
                    boolean ok;
                    try {
                        ok = job.apply(mr);
                    } catch (ShutdownInProgress ex) {
                        throw ex;
                    } catch (Exception ex) {
                        log.error("Machine run {} crashed", mr.getId(), ex);
                        store.finishMachine(mr.getId(), ExecutionStatus.FAILED, "Internal engine error");
                        ok = false;
                    }
                    return Map.entry(mr.getId(), ok);
                });
                active++;
            }
            if (active == 0) {
                break;
            }
            try {
                var r = cs.take().get();
                active--;
                results.put(r.getKey(), r.getValue());
                if (!r.getValue() && stopOnFailure) {
                    stop = true;
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                checkShutdown();
                break;
            } catch (ExecutionException ex) {
                active--;
                checkShutdown();
            }
        }
        while (it.hasNext()) {
            MachineRun mr = it.next();
            if (runtime.isCancelled(executionId)) {
                store.finishMachine(mr.getId(), ExecutionStatus.CANCELLED, "Stopped by user");
            } else {
                skip(executionId, mr, skipReason);
            }
        }
        return results;
    }

    private void skip(Long executionId, MachineRun mr, String reason) {
        store.finishMachine(mr.getId(), ExecutionStatus.SKIPPED, reason);
        events.publish(executionId, "MACHINE_COMPLETED", Map.of("machineRunId", mr.getId(), "status", ExecutionStatus.SKIPPED));
    }

    /** Walks the plan on one machine from {@code start}. Returns true when the path ends successfully. */
    private boolean runMachine(Execution e, ExecutionPlan plan, MachineRun mr, PlanStep start, StepRun preCreated) {
        Long id = e.getId();
        Machine machine = machines.findById(mr.getMachineId()).orElse(null);
        Credential credential = mr.getCredentialId() == null ? null : credentials.findById(mr.getCredentialId()).orElse(null);
        if (machine == null || credential == null) {
            store.finishMachine(mr.getId(), ExecutionStatus.FAILED, "Machine or credential no longer available");
            return false;
        }
        store.setMachineStatus(mr.getId(), ExecutionStatus.RUNNING);
        PlanStep step = start;
        StepRun pending = preCreated;
        boolean lastOk = true;
        String lastFailure = null;
        int guard = 0;
        while (step != null && guard++ <= plan.size()) {
            if (runtime.isCancelled(id)) {
                store.finishMachine(mr.getId(), ExecutionStatus.CANCELLED, "Stopped by user");
                publishMachine(id, mr, ExecutionStatus.CANCELLED);
                return false;
            }
            StepResult r = executeStep(e, mr, machine, credential, step, pending);
            pending = null;
            if (r.cancelled()) {
                store.finishMachine(mr.getId(), ExecutionStatus.CANCELLED, r.failureReason());
                publishMachine(id, mr, ExecutionStatus.CANCELLED);
                return false;
            }
            lastOk = r.success();
            lastFailure = r.success() ? null : "Step '" + step.name() + "' failed: " + r.failureReason();
            step = plan.next(step, r.success());
        }
        String status = lastOk ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;
        store.finishMachine(mr.getId(), status, lastFailure);
        publishMachine(id, mr, status);
        return lastOk;
    }

    private StepResult executeStep(Execution e, MachineRun mr, Machine machine, Credential credential, PlanStep step, StepRun preCreated) {
        Long id = e.getId();
        ResolvedStep resolved;
        try {
            // Re-resolve immediately before running: approval status, parameters and files are re-checked server-side.
            resolved = resolver.resolve(step, e.getStartedBy());
        } catch (ApiException ex) {
            StepRun failed = preCreated != null ? preCreated : store.createStep(mr.getId(), step, null, ExecutionStatus.PENDING, 1, null);
            StepResult r = StepResult.failed(ex.getMessage());
            store.finishStep(failed.getId(), r);
            events.publish(id, "STEP_COMPLETED", Map.of("machineRunId", mr.getId(), "stepRunId", failed.getId(), "status", ExecutionStatus.FAILED));
            return r;
        }
        StepRun run = preCreated != null ? preCreated
                : store.createStep(mr.getId(), step, resolved, step.requiresApproval() ? ExecutionStatus.WAITING_APPROVAL : ExecutionStatus.PENDING, 1, null);
        if (step.requiresApproval() && preCreated == null) {
            ApprovalRequest a = store.createApproval(id, mr.getId(), run.getId(), "STEP", resolved.riskLevel(), "Workflow step '" + step.name() + "' requires approval");
            store.setMachineStatus(mr.getId(), ExecutionStatus.WAITING_APPROVAL);
            store.setExecutionStatus(id, ExecutionStatus.WAITING_APPROVAL);
            events.publish(id, "APPROVAL_REQUIRED", Map.of("approvalId", a.getId(), "scope", "STEP", "stepRunId", run.getId(), "machineRunId", mr.getId(), "riskLevel", resolved.riskLevel()));
            ExecutionRuntime.Decision d = runtime.await(id, a.getId(), approvalTimeout, () -> store.approvalStatus(a.getId()));
            checkShutdown();
            store.resumeAfterApproval(id);
            store.setMachineStatus(mr.getId(), ExecutionStatus.RUNNING);
            if (d != ExecutionRuntime.Decision.APPROVED) {
                closeUndecided(a.getId(), d);
                String why = d == ExecutionRuntime.Decision.REJECTED ? "Step approval rejected" : d == ExecutionRuntime.Decision.EXPIRED ? "Step approval expired" : "Stopped by user";
                StepResult r = StepResult.cancelled(why);
                store.finishStep(run.getId(), r);
                events.publish(id, d == ExecutionRuntime.Decision.REJECTED ? "REJECTED" : "APPROVAL_CLOSED", Map.of("approvalId", a.getId(), "stepRunId", run.getId()));
                return r;
            }
            events.publish(id, "APPROVED", Map.of("approvalId", a.getId(), "stepRunId", run.getId()));
        }
        store.markStepRunning(run.getId(), resolved);
        events.publish(id, "STEP_STARTED", Map.of("machineRunId", mr.getId(), "stepRunId", run.getId(), "name", step.name(), "attempt", run.getAttemptNumber()));
        StepResult r = steps.run(machine, credential, resolved, () -> runtime.isCancelled(id) || shuttingDown, streamer(id, run.getId()));
        checkShutdown();
        store.finishStep(run.getId(), r);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("machineRunId", mr.getId());
        data.put("stepRunId", run.getId());
        data.put("status", r.status());
        data.put("exitCode", r.exitCode());
        events.publish(id, "STEP_COMPLETED", data);
        return r;
    }

    private void runRetry(Long id, Long machineRunId, Long stepRunId) {
        Execution e = store.execution(id);
        ExecutionPlan plan = plans.build(e);
        StepRun retry = store.stepRun(stepRunId);
        PlanStep step = plan.step(retry.getStepKey());
        MachineRun mr = store.machineRun(machineRunId);
        events.publish(id, "STEP_RETRY_STARTED", Map.of("machineRunId", machineRunId, "stepRunId", stepRunId, "attempt", retry.getAttemptNumber()));
        if (step == null) {
            store.finishStep(stepRunId, StepResult.failed("The workflow step no longer exists"));
            store.finishMachine(machineRunId, ExecutionStatus.FAILED, "Retried step no longer exists in the workflow");
        } else {
            runMachine(e, plan, mr, step, retry);
        }
        finish(id);
    }

    private void closeUndecided(Long approvalId, ExecutionRuntime.Decision d) {
        if (d == ExecutionRuntime.Decision.EXPIRED) {
            store.closeApproval(approvalId, ApprovalRequest.EXPIRED);
        } else if (d == ExecutionRuntime.Decision.CANCELLED) {
            store.closeApproval(approvalId, ApprovalRequest.CANCELLED);
        }
    }

    private void checkShutdown() {
        if (shuttingDown) {
            throw new ShutdownInProgress();
        }
    }

    private static final class ShutdownInProgress extends RuntimeException {
        ShutdownInProgress() {
            super(null, null, false, false);
        }
    }

    private void finish(Long id) {
        checkShutdown();
        Execution done = store.finalizeExecution(id);
        String type = switch (done.getStatus()) {
            case ExecutionStatus.SUCCESS -> "EXECUTION_COMPLETED";
            case ExecutionStatus.CANCELLED -> "EXECUTION_CANCELLED";
            default -> "EXECUTION_FAILED";
        };
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", done.getStatus());
        data.put("failureReason", done.getFailureReason());
        events.publish(id, type, data);
        audit.record(done.getStartedBy(), "EXECUTION_FINISHED", "EXECUTION", id, Map.of("status", done.getStatus()));
    }

    private void publishMachine(Long id, MachineRun mr, String status) {
        events.publish(id, "MACHINE_COMPLETED", Map.of("machineRunId", mr.getId(), "status", status));
    }

    /** Streams bounded, throttled output chunks for live views; the persisted result is the source of truth. */
    private OutputListener streamer(Long executionId, Long stepRunId) {
        return new OutputListener() {
            private final StringBuilder buffer = new StringBuilder();
            private long lastFlush = System.currentTimeMillis();
            private int sent;

            @Override
            public synchronized void onOutput(String stream, String chunk) {
                if (sent >= MAX_STREAMED_BYTES_PER_STEP) {
                    return;
                }
                buffer.append(chunk);
                long now = System.currentTimeMillis();
                if (buffer.length() >= 2048 || now - lastFlush > 400) {
                    String text = buffer.length() > 4096 ? buffer.substring(0, 4096) : buffer.toString();
                    buffer.setLength(0);
                    lastFlush = now;
                    sent += text.length();
                    events.publish(executionId, "STEP_OUTPUT", Map.of("stepRunId", stepRunId, "stream", stream, "chunk", text));
                }
            }
        };
    }
}
