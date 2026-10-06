package com.autoops.execution.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.engine.ExecutionRuntime;
import com.autoops.execution.entity.ApprovalRequest;
import com.autoops.execution.entity.Execution;
import com.autoops.execution.repository.ApprovalRequestRepository;
import com.autoops.execution.repository.ExecutionRepository;
import com.autoops.execution.repository.MachineRunRepository;
import com.autoops.execution.repository.StepRunRepository;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Human decisions on persisted approval requests. The backend enforces the policy: only the execution owner (or an
 * Admin) may decide, and HIGH risk requires an explicit acknowledgement.
 */
@Service
public class ApprovalService {
    private final ApprovalRequestRepository repo;
    private final ExecutionRepository executions;
    private final MachineRunRepository machineRuns;
    private final MachineRepository machines;
    private final StepRunRepository steps;
    private final ExecutionQueryService queries;
    private final ExecutionRuntime runtime;
    private final AuditService audit;
    private final TransactionTemplate tx;

    public ApprovalService(ApprovalRequestRepository repo, ExecutionRepository executions, MachineRunRepository machineRuns,
                           MachineRepository machines, StepRunRepository steps, ExecutionQueryService queries, ExecutionRuntime runtime,
                           AuditService audit, TransactionTemplate tx) {
        this.repo = repo;
        this.executions = executions;
        this.machineRuns = machineRuns;
        this.machines = machines;
        this.steps = steps;
        this.queries = queries;
        this.runtime = runtime;
        this.audit = audit;
        this.tx = tx;
    }

    public List<ExecutionDtos.ApprovalView> pending(AuthenticatedUser user, boolean all) {
        List<ApprovalRequest> list = all && user.isAdmin() ? repo.findByStatusOrderByIdAsc(ApprovalRequest.PENDING) : repo.findPendingForUser(user.id());
        return list.stream().map(this::view).toList();
    }

    public ExecutionDtos.ApprovalView decide(AuthenticatedUser user, Long id, ExecutionDtos.Decision d) {
        boolean approve = Boolean.TRUE.equals(d.approve());
        boolean ack = Boolean.TRUE.equals(d.highRiskAcknowledged());
        ApprovalRequest decided = tx.execute(s -> {
            ApprovalRequest a = repo.findById(id).orElseThrow(() -> ApiException.notFound("Approval"));
            Execution e = a.getExecutionId() == null ? null : executions.findById(a.getExecutionId()).orElse(null);
            if (e == null || (!user.isAdmin() && !user.id().equals(e.getStartedBy()))) {
                throw ApiException.notFound("Approval");
            }
            if (!ApprovalRequest.PENDING.equals(a.getStatus())) {
                throw ApiException.conflict("APPROVAL_DECIDED", "This approval was already " + a.getStatus().toLowerCase());
            }
            if (approve && "HIGH".equals(a.getRiskLevel()) && !ack) {
                throw ApiException.validation("High-risk operation: explicitly acknowledge the risk to approve",
                        Map.of("highRiskAcknowledged", "Required for HIGH risk"));
            }
            a.setStatus(approve ? ApprovalRequest.APPROVED : ApprovalRequest.REJECTED);
            a.setApprovedBy(user.id());
            a.setDecidedAt(Instant.now());
            a.setHighRiskAcknowledged(approve && ack);
            a.setDecisionComment(d.comment() == null || d.comment().isBlank() ? null : d.comment().trim());
            return repo.save(a);
        });
        // Wake the engine only after the decision is committed.
        runtime.complete(decided.getExecutionId(), decided.getId(), approve);
        audit.record(user.id(), approve ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED", "EXECUTION", decided.getExecutionId(),
                Map.of("approvalId", id, "risk", decided.getRiskLevel(), "scope", decided.getScope(), "highRiskAcknowledged", decided.isHighRiskAcknowledged()));
        return view(decided);
    }

    private ExecutionDtos.ApprovalView view(ApprovalRequest a) {
        Execution e = a.getExecutionId() == null ? null : executions.findById(a.getExecutionId()).orElse(null);
        String machineName = a.getMachineRunId() == null ? null : machineRuns.findById(a.getMachineRunId())
                .flatMap(mr -> machines.findById(mr.getMachineId())).map(m -> m.getName()).orElse(null);
        String stepName = a.getStepRunId() == null ? null : steps.findById(a.getStepRunId()).map(s -> s.getStepName()).orElse(null);
        return queries.approval(a, e, machineName, stepName);
    }
}
