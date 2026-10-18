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


import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;
import java.util.function.BooleanSupplier;

final class FileTransferRunner {
    private final MachineConnectionService connections;
    private final ObjectStorageService storage;
    private final StoredFileRepository files;
    FileTransferRunner(MachineConnectionService connections, ObjectStorageService storage, StoredFileRepository files) {
        this.connections = connections; this.storage = storage; this.files = files;
    }
    /**
     * Uploads the stored file to a temporary path next to (or, for privileged destinations, outside) the destination,
     * verifies its SHA-256 on the machine, then moves it into place with fixed, server-built commands.
     */
    StepResult run(Machine machine, Credential credential, ResolvedStep step, BooleanSupplier cancelled) {
        var def = (StepDefinition.FileTransfer) step.step().definition();
        ResolvedStep.FileSource src = step.file();
        StoredFile stored = files.findById(src.id()).orElse(null);
        if (stored == null || stored.getDeletedAt() != null) {
            return StepResult.failed("Stored file is no longer available");
        }
        if (stored.getFolderName() != null) return new FolderTransferRunner(connections, storage).run(machine, credential, step, stored, cancelled);
        if (cancelled.getAsBoolean()) return StepResult.failed("Transfer cancelled");
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

}
