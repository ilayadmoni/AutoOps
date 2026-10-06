package com.autoops.execution.engine;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/** In-memory coordination for running executions: cancellation flags and threads waiting for approval decisions. */
@Component
public class ExecutionRuntime {
    public enum Decision { APPROVED, REJECTED, CANCELLED, EXPIRED }

    private static final class RunState {
        volatile boolean cancelled;
        final Map<Long, CompletableFuture<Decision>> waiters = new ConcurrentHashMap<>();
    }

    private final Map<Long, RunState> states = new ConcurrentHashMap<>();

    public void register(Long executionId) {
        states.computeIfAbsent(executionId, k -> new RunState());
    }

    public void unregister(Long executionId) {
        states.remove(executionId);
    }

    public boolean isActive(Long executionId) {
        return states.containsKey(executionId);
    }

    public boolean isCancelled(Long executionId) {
        RunState s = states.get(executionId);
        return s != null && s.cancelled;
    }

    /** Sets the cancellation flag and releases any thread waiting for an approval in this execution. */
    public boolean cancel(Long executionId) {
        RunState s = states.get(executionId);
        if (s == null) {
            return false;
        }
        s.cancelled = true;
        s.waiters.values().forEach(f -> f.complete(Decision.CANCELLED));
        return true;
    }

    public void complete(Long executionId, Long approvalId, boolean approved) {
        RunState s = states.get(executionId);
        if (s != null) {
            CompletableFuture<Decision> f = s.waiters.get(approvalId);
            if (f != null) {
                f.complete(approved ? Decision.APPROVED : Decision.REJECTED);
            }
        }
    }

    /**
     * Blocks until the approval is decided, the execution is cancelled, or the timeout elapses. The persisted status
     * is consulted after registering, so a decision made just before waiting is not lost.
     */
    public Decision await(Long executionId, Long approvalId, Duration timeout, Supplier<String> persistedStatus) {
        RunState s = states.computeIfAbsent(executionId, k -> new RunState());
        CompletableFuture<Decision> f = s.waiters.computeIfAbsent(approvalId, k -> new CompletableFuture<>());
        try {
            if (s.cancelled) {
                return Decision.CANCELLED;
            }
            String status = persistedStatus.get();
            if ("APPROVED".equals(status)) {
                return Decision.APPROVED;
            }
            if ("REJECTED".equals(status)) {
                return Decision.REJECTED;
            }
            return f.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            return Decision.EXPIRED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Decision.CANCELLED;
        } catch (Exception e) {
            return Decision.CANCELLED;
        } finally {
            s.waiters.remove(approvalId);
        }
    }
}
