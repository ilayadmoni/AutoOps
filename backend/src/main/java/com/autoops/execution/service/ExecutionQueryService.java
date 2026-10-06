package com.autoops.execution.service;

import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.credential.entity.Credential;
import com.autoops.credential.repository.CredentialRepository;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.engine.ExecutionPlanFactory;
import com.autoops.execution.entity.*;
import com.autoops.execution.repository.*;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read side of executions. Owners see their executions; Admins may see all. Never exposes secrets. */
@Service
public class ExecutionQueryService {
    private final ExecutionRepository executions;
    private final MachineRunRepository machineRuns;
    private final PreflightRunRepository preflights;
    private final StepRunRepository steps;
    private final ApprovalRequestRepository approvals;
    private final MachineRepository machines;
    private final CredentialRepository credentials;
    private final ExecutionPlanFactory plans;

    public ExecutionQueryService(ExecutionRepository executions, MachineRunRepository machineRuns, PreflightRunRepository preflights,
                                 StepRunRepository steps, ApprovalRequestRepository approvals, MachineRepository machines,
                                 CredentialRepository credentials, ExecutionPlanFactory plans) {
        this.executions = executions;
        this.machineRuns = machineRuns;
        this.preflights = preflights;
        this.steps = steps;
        this.approvals = approvals;
        this.machines = machines;
        this.credentials = credentials;
        this.plans = plans;
    }

    /** Owner, or Admin; otherwise 404 so execution ids cannot be probed. */
    @Transactional(readOnly = true)
    public Execution requireVisible(AuthenticatedUser user, Long id) {
        Execution e = executions.findById(id).orElseThrow(() -> ApiException.notFound("Execution"));
        if (!user.isAdmin() && !user.id().equals(e.getStartedBy())) {
            throw ApiException.notFound("Execution");
        }
        return e;
    }

    @Transactional(readOnly = true)
    public ExecutionDtos.Page<ExecutionDtos.Summary> list(AuthenticatedUser user, boolean all, int page, int size) {
        int s = Math.max(1, Math.min(size, 100));
        var p = all && user.isAdmin()
                ? executions.findAllByOrderByIdDesc(PageRequest.of(Math.max(0, page), s))
                : executions.findByStartedByOrderByIdDesc(user.id(), PageRequest.of(Math.max(0, page), s));
        List<Long> ids = p.getContent().stream().map(Execution::getId).toList();
        Map<Long, List<MachineRun>> runs = machineRuns.findByExecutionIdIn(ids).stream().collect(Collectors.groupingBy(MachineRun::getExecutionId));
        List<ExecutionDtos.Summary> items = p.getContent().stream()
                .map(e -> summary(e, runs.getOrDefault(e.getId(), List.of()), pendingCount(e.getId()))).toList();
        return new ExecutionDtos.Page<>(items, p.getNumber(), s, p.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ExecutionDtos.Detail detail(AuthenticatedUser user, Long id) {
        Execution e = requireVisible(user, id);
        List<MachineRun> runs = machineRuns.findByExecutionIdOrderByPositionAsc(id);
        List<Long> runIds = runs.stream().map(MachineRun::getId).toList();
        Map<Long, PreflightRun> pre = new HashMap<>();
        preflights.findByMachineRunIdInOrderByIdAsc(runIds).forEach(p -> pre.put(p.getMachineRunId(), p));
        Map<Long, List<StepRun>> stepMap = steps.findByMachineRunIdInOrderByIdAsc(runIds).stream().collect(Collectors.groupingBy(StepRun::getMachineRunId));
        Map<Long, Machine> machineMap = machines.findAllById(runs.stream().map(MachineRun::getMachineId).toList()).stream()
                .collect(Collectors.toMap(Machine::getId, Function.identity()));
        Map<Long, Credential> credMap = credentials.findAllById(runs.stream().map(MachineRun::getCredentialId).filter(Objects::nonNull).toList()).stream()
                .collect(Collectors.toMap(Credential::getId, Function.identity()));
        List<ApprovalRequest> approvalList = approvals.findByExecutionIdOrderByIdAsc(id);
        boolean ownerCanRetry = user.id().equals(e.getStartedBy())
                && (ExecutionStatus.FAILED.equals(e.getStatus()) || ExecutionStatus.PARTIAL.equals(e.getStatus()));
        List<ExecutionDtos.MachineRunView> machineViews = runs.stream().map(mr -> {
            Machine m = machineMap.get(mr.getMachineId());
            Credential c = mr.getCredentialId() == null ? null : credMap.get(mr.getCredentialId());
            List<StepRun> list = stepMap.getOrDefault(mr.getId(), List.of());
            Set<Long> retried = list.stream().map(StepRun::getRetryOfStepRunId).filter(Objects::nonNull).collect(Collectors.toSet());
            StepRun lastStep = list.isEmpty() ? null : list.get(list.size() - 1);
            List<ExecutionDtos.StepRunView> stepViews = list.stream().map(s -> step(s,
                    ownerCanRetry && ExecutionStatus.FAILED.equals(mr.getStatus()) && ExecutionStatus.FAILED.equals(s.getStatus())
                            && !retried.contains(s.getId()) && s == lastStep)).toList();
            return new ExecutionDtos.MachineRunView(mr.getId(), mr.getMachineId(), m == null ? "#" + mr.getMachineId() : m.getName(),
                    m == null ? null : m.getHostname(), mr.getCredentialId(), c == null ? null : c.getName(), mr.getStatus(),
                    mr.getFailureReason(), mr.getStartedAt(), mr.getFinishedAt(), preflight(pre.get(mr.getId())), stepViews);
        }).toList();
        Map<Long, String> machineNames = machineViews.stream().collect(Collectors.toMap(ExecutionDtos.MachineRunView::id, ExecutionDtos.MachineRunView::machineName));
        Map<Long, String> stepNames = new HashMap<>();
        stepMap.values().forEach(l -> l.forEach(s -> stepNames.put(s.getId(), s.getStepName())));
        List<ExecutionDtos.ApprovalView> approvalViews = approvalList.stream()
                .map(a -> approval(a, e, machineNames.get(a.getMachineRunId()), stepNames.get(a.getStepRunId()))).toList();
        return new ExecutionDtos.Detail(summary(e, runs, approvalList.stream().filter(a -> ApprovalRequest.PENDING.equals(a.getStatus())).count()),
                plans.parameters(e.getParameters()), e.isRunWithSudo(), machineViews, approvalViews);
    }

    public ExecutionDtos.ApprovalView approval(ApprovalRequest a, Execution e, String machineName, String stepName) {
        return new ExecutionDtos.ApprovalView(a.getId(), a.getExecutionId(), e == null ? null : e.getTitle(), e == null ? null : e.getType(),
                a.getMachineRunId(), machineName, a.getStepRunId(), stepName, a.getScope(), a.getRiskLevel(), a.getReason(), a.getStatus(),
                a.getRequestedAt(), a.getDecidedAt(), a.getApprovedBy(), a.isHighRiskAcknowledged(), a.getDecisionComment());
    }

    private long pendingCount(Long executionId) {
        return approvals.findByExecutionIdAndStatus(executionId, ApprovalRequest.PENDING).size();
    }

    private static ExecutionDtos.Summary summary(Execution e, List<MachineRun> runs, long pending) {
        int ok = (int) runs.stream().filter(r -> ExecutionStatus.SUCCESS.equals(r.getStatus())).count();
        int failed = (int) runs.stream().filter(r -> ExecutionStatus.FAILED.equals(r.getStatus())).count();
        return new ExecutionDtos.Summary(e.getId(), e.getType(), e.getTitle(), e.getCommandDefinitionId(), e.getWorkflowId(), e.getStatus(),
                e.getMode(), e.getRiskLevel(), e.getConcurrency(), e.getFailurePolicy(), runs.size(), ok, failed, pending, e.getFailureReason(),
                e.getCancelRequestedAt() != null, e.getStartedBy(), e.getCreatedAt(), e.getStartedAt(), e.getFinishedAt());
    }

    private static ExecutionDtos.PreflightView preflight(PreflightRun p) {
        if (p == null) {
            return null;
        }
        return new ExecutionDtos.PreflightView(p.getId(), p.getStatus(), p.getSshStatus(), p.getHostVerificationStatus(), p.getAuthenticationStatus(),
                p.getOsStatus(), p.getSudoStatus(), p.getFilesStatus(), p.getParametersStatus(), p.getFailureReason(), p.getStartedAt(), p.getFinishedAt());
    }

    private static ExecutionDtos.StepRunView step(StepRun s, boolean retryable) {
        return new ExecutionDtos.StepRunView(s.getId(), s.getWorkflowStepId(), s.getStepKey(), s.getStepType(), s.getStepName(), s.getRiskLevel(),
                s.isRunWithSudo(), s.getStatus(), s.getOriginalCommand(), s.getResolvedCommand(), s.getStdout(), s.getStderr(), s.getExitCode(),
                s.getFailureReason(), s.getAttemptNumber(), s.getRetryOfStepRunId(), retryable, s.getStartedAt(), s.getFinishedAt());
    }
}
