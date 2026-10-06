package com.autoops.execution.entity;

import java.util.Set;

/** Status vocabulary shared by executions, machine runs and step runs. */
public final class ExecutionStatus {
    public static final String PENDING = "PENDING";
    public static final String PREFLIGHT = "PREFLIGHT";
    public static final String WAITING_APPROVAL = "WAITING_APPROVAL";
    public static final String RUNNING = "RUNNING";
    public static final String SUCCESS = "SUCCESS";
    public static final String FAILED = "FAILED";
    public static final String PARTIAL = "PARTIAL";
    public static final String CANCELLED = "CANCELLED";
    public static final String SKIPPED = "SKIPPED";

    public static final Set<String> TERMINAL = Set.of(SUCCESS, FAILED, PARTIAL, CANCELLED, SKIPPED);
    public static final Set<String> ACTIVE_EXECUTION = Set.of(PENDING, RUNNING, WAITING_APPROVAL);

    private ExecutionStatus() {
    }

    public static boolean isTerminal(String status) {
        return TERMINAL.contains(status);
    }
}
