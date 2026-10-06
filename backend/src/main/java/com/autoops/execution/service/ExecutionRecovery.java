package com.autoops.execution.service;

import com.autoops.execution.entity.*;
import com.autoops.execution.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * In-flight executions cannot survive a restart (their threads and SSH sessions are gone). On startup they are
 * closed deterministically instead of being left looking active.
 */
@Component
@Order(5)
public class ExecutionRecovery implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ExecutionRecovery.class);
    private static final List<String> OPEN = List.of(ExecutionStatus.PENDING, ExecutionStatus.PREFLIGHT, ExecutionStatus.WAITING_APPROVAL, ExecutionStatus.RUNNING);
    private final ExecutionRepository executions;
    private final MachineRunRepository machineRuns;
    private final PreflightRunRepository preflights;
    private final StepRunRepository steps;
    private final ApprovalRequestRepository approvals;

    public ExecutionRecovery(ExecutionRepository executions, MachineRunRepository machineRuns, PreflightRunRepository preflights,
                             StepRunRepository steps, ApprovalRequestRepository approvals) {
        this.executions = executions;
        this.machineRuns = machineRuns;
        this.preflights = preflights;
        this.steps = steps;
        this.approvals = approvals;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Instant now = Instant.now();
        String reason = "Interrupted by server restart";
        steps.findByStatusIn(OPEN).forEach(s -> {
            s.setStatus(ExecutionStatus.FAILED);
            s.setFailureReason(reason);
            s.setFinishedAt(now);
        });
        preflights.findByStatusIn(OPEN).forEach(p -> {
            p.setStatus(ExecutionStatus.FAILED);
            p.setFailureReason(reason);
            p.setFinishedAt(now);
        });
        machineRuns.findByStatusIn(OPEN).forEach(m -> {
            m.setStatus(ExecutionStatus.FAILED);
            m.setFailureReason(reason);
            m.setFinishedAt(now);
        });
        approvals.findByStatusOrderByIdAsc(ApprovalRequest.PENDING).forEach(a -> {
            a.setStatus(ApprovalRequest.EXPIRED);
            a.setDecidedAt(now);
        });
        List<Execution> open = executions.findByStatusIn(List.of(ExecutionStatus.PENDING, ExecutionStatus.WAITING_APPROVAL, ExecutionStatus.RUNNING));
        open.forEach(e -> {
            e.setStatus(e.getCancelRequestedAt() != null ? ExecutionStatus.CANCELLED : ExecutionStatus.FAILED);
            e.setFailureReason(reason);
            e.setFinishedAt(now);
        });
        if (!open.isEmpty()) {
            log.warn("Closed {} execution(s) interrupted by a restart", open.size());
        }
    }
}
