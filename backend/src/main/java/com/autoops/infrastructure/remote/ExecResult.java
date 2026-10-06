package com.autoops.infrastructure.remote;

public record ExecResult(int exitCode, String stdout, String stderr, boolean timedOut, boolean cancelled) {
    public boolean success() {
        return exitCode == 0 && !timedOut && !cancelled;
    }
}
