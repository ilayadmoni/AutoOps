package com.autoops.execution.engine;

import com.autoops.execution.entity.ExecutionStatus;

public record StepResult(String status, String stdout, String stderr, Integer exitCode, String failureReason) {
    public boolean success() {
        return ExecutionStatus.SUCCESS.equals(status);
    }

    public boolean cancelled() {
        return ExecutionStatus.CANCELLED.equals(status);
    }

    public static StepResult failed(String reason) {
        return new StepResult(ExecutionStatus.FAILED, null, null, null, reason);
    }

    public static StepResult cancelled(String reason) {
        return new StepResult(ExecutionStatus.CANCELLED, null, null, null, reason);
    }
}
