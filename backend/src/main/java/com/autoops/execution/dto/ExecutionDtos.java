package com.autoops.execution.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class ExecutionDtos {
    private ExecutionDtos() {
    }

    /** No resolved command is accepted: the server resolves the approved template with validated parameters. */
    public record StartCommand(
            @NotNull Long commandDefinitionId,
            @NotEmpty @Size(max = 50) List<@NotNull Long> machineIds,
            Long credentialId,
            Map<String, String> parameters,
            Boolean runWithSudo,
            @Pattern(regexp = "^(MANUAL|AUTOMATIC)$") String mode,
            @Min(1) @Max(3) Integer concurrency,
            @Pattern(regexp = "^(STOP_NEW_MACHINES|CONTINUE)$") String failurePolicy) {
    }

    public record RunOptions(
            @NotEmpty @Size(max = 50) List<@NotNull Long> machineIds,
            Long credentialId,
            @Pattern(regexp = "^(MANUAL|AUTOMATIC)$") String mode,
            @Min(1) @Max(3) Integer concurrency,
            @Pattern(regexp = "^(STOP_NEW_MACHINES|CONTINUE)$") String failurePolicy) {
    }

    public record Summary(Long id, String type, String title, Long commandDefinitionId, Long workflowId, String status, String mode,
                          String riskLevel, int concurrency, String failurePolicy, int machineCount, int succeededMachines,
                          int failedMachines, long pendingApprovals, String failureReason, boolean cancelRequested, Long startedBy,
                          Instant createdAt, Instant startedAt, Instant finishedAt) {
    }

    public record Detail(Summary summary, Map<String, String> parameters, boolean runWithSudo, List<MachineRunView> machines,
                         List<ApprovalView> approvals) {
    }

    public record MachineRunView(Long id, Long machineId, String machineName, String hostname, Long credentialId, String credentialName,
                                 String status, String failureReason, Instant startedAt, Instant finishedAt, PreflightView preflight,
                                 List<StepRunView> steps) {
    }

    public record PreflightView(Long id, String status, String sshStatus, String hostVerificationStatus, String authenticationStatus,
                                String osStatus, String sudoStatus, String filesStatus, String parametersStatus, String failureReason,
                                Instant startedAt, Instant finishedAt) {
    }

    public record StepRunView(Long id, Long workflowStepId, String stepKey, String stepType, String stepName, String riskLevel,
                              boolean runWithSudo, String status, String originalCommand, String resolvedCommand, String stdout,
                              String stderr, Integer exitCode, String failureReason, int attemptNumber, Long retryOfStepRunId,
                              boolean retryable, Instant startedAt, Instant finishedAt) {
    }

    public record ApprovalView(Long id, Long executionId, String executionTitle, String executionType, Long machineRunId, String machineName,
                               Long stepRunId, String stepName, String scope, String riskLevel, String reason, String status,
                               Instant requestedAt, Instant decidedAt, Long decidedBy, boolean highRiskAcknowledged, String comment) {
    }

    public record Decision(@NotNull Boolean approve, Boolean highRiskAcknowledged, @Size(max = 1000) String comment) {
    }

    public record Retry(Boolean highRiskAcknowledged) {
    }

    public record Page<T>(List<T> items, int page, int size, long total) {
    }
}
