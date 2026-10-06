package com.autoops.execution.engine;

import com.autoops.credential.entity.Credential;
import com.autoops.execution.entity.ExecutionStatus;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.execution.plan.StepDefinition;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.repository.StoredFileRepository;
import com.autoops.files.service.ObjectStorageService;
import com.autoops.infrastructure.remote.ExecResult;
import com.autoops.infrastructure.remote.OutputListener;
import com.autoops.infrastructure.remote.RemoteException;
import com.autoops.infrastructure.remote.RemoteSession;
import com.autoops.infrastructure.remote.ShellCommands;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineConnectionService;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;
import java.util.function.BooleanSupplier;

/**
 * Executes one resolved step on one machine over a host-verified session. Only server-resolved commands are run;
 * sudo is applied here, by the execution layer, never baked into templates.
 */
@Component
public class StepRunner {
    private final MachineConnectionService connections;
    private final ObjectStorageService storage;
    private final StoredFileRepository files;

    public StepRunner(MachineConnectionService connections, ObjectStorageService storage, StoredFileRepository files) {
        this.connections = connections;
        this.storage = storage;
        this.files = files;
    }

    public StepResult run(Machine machine, Credential credential, ResolvedStep step, BooleanSupplier cancelled, OutputListener listener) {
        try {
            return switch (step.type()) {
                case "COMMAND" -> command(machine, credential, step, listener);
                case "WAIT_UNTIL" -> waitUntil(machine, credential, step, cancelled);
                case "FILE_TRANSFER" -> transfer(machine, credential, step);
                default -> StepResult.failed("Unsupported step type " + step.type());
            };
        } catch (RemoteException e) {
            return StepResult.failed(e.getMessage());
        } catch (ObjectStorageService.StorageException e) {
            return StepResult.failed(e.getMessage());
        }
    }

    /** Commands run to completion (bounded by their timeout); Stop takes effect at the next step boundary. */
    private StepResult command(Machine machine, Credential credential, ResolvedStep step, OutputListener listener) {
        try (RemoteSession session = connections.connect(machine, credential)) {
            ExecResult r = exec(session, credential, step.resolvedCommand(), step.runWithSudo(), step.timeoutSeconds(), () -> false, listener);
            return fromExec(r, step.timeoutSeconds());
        }
    }

    private StepResult waitUntil(Machine machine, Credential credential, ResolvedStep step, BooleanSupplier cancelled) {
        var def = (StepDefinition.WaitUntil) step.step().definition();
        int interval = Math.max(1, Math.min(300, def.intervalSeconds() <= 0 ? 5 : def.intervalSeconds()));
        long deadline = System.currentTimeMillis() + step.timeoutSeconds() * 1000L;
        int attempts = 0;
        ExecResult last = null;
        try (RemoteSession session = connections.connect(machine, credential)) {
            while (true) {
                if (cancelled.getAsBoolean()) {
                    return new StepResult(ExecutionStatus.CANCELLED, out(last), err(last), last == null ? null : last.exitCode(), "Stopped by user while waiting");
                }
                attempts++;
                int remaining = (int) Math.max(1, (deadline - System.currentTimeMillis()) / 1000);
                last = exec(session, credential, step.resolvedCommand(), step.runWithSudo(), Math.min(60, remaining), cancelled, null);
                if (matches(def, last)) {
                    return new StepResult(ExecutionStatus.SUCCESS, out(last), err(last), last.exitCode(), null);
                }
                if (System.currentTimeMillis() + interval * 1000L > deadline) {
                    return new StepResult(ExecutionStatus.FAILED, out(last), err(last), last.exitCode(),
                            "Condition " + def.checkType() + " not met after " + attempts + " check(s) within " + step.timeoutSeconds() + "s");
                }
                if (!sleep(interval, cancelled)) {
                    return new StepResult(ExecutionStatus.CANCELLED, out(last), err(last), last.exitCode(), "Stopped by user while waiting");
                }
            }
        }
    }

    static boolean matches(StepDefinition.WaitUntil def, ExecResult r) {
        if (r.timedOut() || r.cancelled()) {
            return false;
        }
        return switch (def.checkType()) {
            case "OUTPUT_CONTAINS" -> r.stdout() != null && r.stdout().contains(def.expectedOutput());
            case "EXIT_CODE" -> r.exitCode() == (def.expectedExitCode() == null ? 0 : def.expectedExitCode());
            case "FILE_EXISTS", "SERVICE_ACTIVE" -> r.exitCode() == 0;
            default -> false;
        };
    }

    /**
     * Uploads the stored file to a temporary path next to (or, for privileged destinations, outside) the destination,
     * verifies its SHA-256 on the machine, then moves it into place with fixed, server-built commands.
     */
    private StepResult transfer(Machine machine, Credential credential, ResolvedStep step) {
        var def = (StepDefinition.FileTransfer) step.step().definition();
        ResolvedStep.FileSource src = step.file();
        StoredFile stored = files.findById(src.id()).orElse(null);
        if (stored == null || stored.getDeletedAt() != null) {
            return StepResult.failed("Stored file is no longer available");
        }
        String dest = step.destinationPath();
        String qDest = ShellCommands.quote(dest);
        String tmp = def.useSudo() ? "/tmp/.autoops-" + UUID.randomUUID() : dest + ".autoops-" + UUID.randomUUID().toString().substring(0, 8);
        String qTmp = ShellCommands.quote(tmp);
        StringBuilder log = new StringBuilder();
        try (RemoteSession session = connections.connect(machine, credential)) {
            if (!def.overwrite()) {
                ExecResult exists = exec(session, credential, "test -e " + qDest, def.useSudo(), 30, () -> false, null);
                if (exists.success()) {
                    return new StepResult(ExecutionStatus.FAILED, null, exists.stderr(), 1, "Destination " + dest + " already exists and overwrite is disabled");
                }
            }
            try (InputStream in = storage.get(stored.getObjectKey())) {
                session.upload(in, stored.getSize(), tmp, step.timeoutSeconds());
            } catch (RemoteException e) {
                cleanup(session, credential, qTmp, false);
                return StepResult.failed(e.getMessage() + " (uploading to " + tmp + ")");
            } catch (java.io.IOException e) {
                cleanup(session, credential, qTmp, false);
                return StepResult.failed("Could not read stored file content");
            }
            log.append("Uploaded ").append(stored.getSize()).append(" bytes to temporary path\n");
            ExecResult sum = session.exec("sha256sum -- " + qTmp, 120);
            String remoteSum = sum.stdout() == null ? "" : sum.stdout().trim().split("\\s+")[0].toLowerCase(Locale.ROOT);
            if (!sum.success() || !remoteSum.equals(stored.getChecksum().toLowerCase(Locale.ROOT))) {
                cleanup(session, credential, qTmp, false);
                return new StepResult(ExecutionStatus.FAILED, log.toString(), sum.stderr(), sum.exitCode(),
                        sum.success() ? "Checksum mismatch after transfer" : "Could not verify checksum on the machine (sha256sum unavailable?)");
            }
            log.append("SHA-256 verified: ").append(remoteSum).append('\n');
            String move = def.useSudo()
                    ? "cp -- " + qTmp + " " + qDest + " && rm -f -- " + qTmp
                    : "mv -f -- " + qTmp + " " + qDest;
            ExecResult mv = exec(session, credential, move, def.useSudo(), 120, () -> false, null);
            if (!mv.success()) {
                cleanup(session, credential, qTmp, false);
                return new StepResult(ExecutionStatus.FAILED, log.toString(), mv.stderr(), mv.exitCode(), "Could not move file into " + dest);
            }
            if (def.useSudo()) {
                cleanup(session, credential, qTmp, false);
            }
            log.append("Placed at ").append(dest).append('\n');
            return new StepResult(ExecutionStatus.SUCCESS, log.toString(), "", 0, null);
        }
    }

    private void cleanup(RemoteSession session, Credential credential, String qTmp, boolean sudo) {
        try {
            exec(session, credential, "rm -f -- " + qTmp, sudo, 30, () -> false, null);
        } catch (RuntimeException ignored) {
            // best effort
        }
    }

    private ExecResult exec(RemoteSession session, Credential credential, String command, boolean sudo, int timeout,
                            BooleanSupplier cancelled, OutputListener listener) {
        if (sudo) {
            return session.exec(ShellCommands.withSudo(command), connections.sudoPassword(credential), timeout, cancelled, listener);
        }
        return session.exec(command, null, timeout, cancelled, listener);
    }

    private static StepResult fromExec(ExecResult r, int timeout) {
        if (r.cancelled()) {
            return new StepResult(ExecutionStatus.CANCELLED, r.stdout(), r.stderr(), null, "Stopped by user");
        }
        if (r.timedOut()) {
            return new StepResult(ExecutionStatus.FAILED, r.stdout(), r.stderr(), null, "Timed out after " + timeout + "s");
        }
        return new StepResult(r.exitCode() == 0 ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED, r.stdout(), r.stderr(), r.exitCode(),
                r.exitCode() == 0 ? null : "Exited with code " + r.exitCode());
    }

    private static boolean sleep(int seconds, BooleanSupplier cancelled) {
        long end = System.currentTimeMillis() + seconds * 1000L;
        while (System.currentTimeMillis() < end) {
            if (cancelled.getAsBoolean()) {
                return false;
            }
            try {
                Thread.sleep(250);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return true;
    }

    private static String out(ExecResult r) {
        return r == null ? null : r.stdout();
    }

    private static String err(ExecResult r) {
        return r == null ? null : r.stderr();
    }
}
