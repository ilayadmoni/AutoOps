package com.autoops.execution.engine;

import com.autoops.credential.entity.Credential;
import com.autoops.execution.entity.ExecutionStatus;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.execution.plan.StepDefinition;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.service.ObjectStorageService;
import com.autoops.infrastructure.remote.*;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineConnectionService;
import java.io.IOException;
import java.util.UUID;
import java.util.function.BooleanSupplier;

final class FolderTransferRunner {
    private final MachineConnectionService connections;
    private final ObjectStorageService storage;
    FolderTransferRunner(MachineConnectionService connections, ObjectStorageService storage) {
        this.connections = connections; this.storage = storage;
    }
    StepResult run(Machine machine, Credential credential, ResolvedStep step, StoredFile stored, BooleanSupplier cancelled) {
        if (cancelled.getAsBoolean()) return new StepResult(ExecutionStatus.CANCELLED, "", "", null, "Stopped by user");
        String nonce = UUID.randomUUID().toString();
        String archive = "/tmp/.autoops-" + nonce + ".tar.gz";
        var def = (StepDefinition.FileTransfer) step.step().definition();
        try (RemoteSession session = connections.connect(machine, credential)) {
            try {
                try (var in = storage.get(stored.getObjectKey())) { session.upload(in, stored.getSize(), archive, step.timeoutSeconds()); }
                String command = FolderDeployCommands.deploy(archive, step.destinationPath(), stored.getChecksum(), def.overwrite(), nonce);
                ExecResult result = session.exec(def.useSudo() ? ShellCommands.withSudo(command) : command,
                        def.useSudo() ? connections.sudoPassword(credential) : null, step.timeoutSeconds(), cancelled, null);
                String status = result.cancelled() ? ExecutionStatus.CANCELLED
                        : result.success() ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;
                String error = result.cancelled() ? "Stopped by user" : result.timedOut() ? "Folder deployment timed out"
                        : result.success() ? null : failure(result.stderr());
                return new StepResult(status, result.stdout(), result.stderr(), result.exitCode(), error);
            } catch (IOException e) { return StepResult.failed("Could not read folder package"); }
            finally {
                try { session.exec("rm -f -- " + ShellCommands.quote(archive), 30); }
                catch (RuntimeException ignored) { /* Best effort after disconnected/cancelled sessions. */ }
            }
        }
    }
    static String failure(String stderr) {
        String detail = stderr == null ? "" : stderr.strip();
        if (detail.isEmpty()) return "Folder deployment failed; inspect stderr";
        return "Folder deployment failed: " + detail.substring(0, Math.min(500, detail.length()));
    }
}
