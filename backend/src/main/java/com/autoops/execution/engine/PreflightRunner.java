package com.autoops.execution.engine;

import com.autoops.common.error.ApiException;
import com.autoops.credential.entity.Credential;
import com.autoops.credential.repository.CredentialRepository;
import com.autoops.execution.entity.Execution;
import com.autoops.execution.entity.ExecutionStatus;
import com.autoops.execution.entity.MachineRun;
import com.autoops.execution.entity.PreflightRun;
import com.autoops.execution.plan.ExecutionPlan;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.execution.plan.StepResolver;
import com.autoops.execution.realtime.ExecutionEventPublisher;
import com.autoops.infrastructure.remote.ExecResult;
import com.autoops.infrastructure.remote.OsInfo;
import com.autoops.infrastructure.remote.RemoteException;
import com.autoops.infrastructure.remote.RemoteSession;
import com.autoops.infrastructure.remote.ShellCommands;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import com.autoops.machine.service.MachineConnectionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Per-machine preflight. It is a hard gate: a machine whose preflight fails never runs a real step.
 * Checks eligibility, credential, parameters/commands, files, host trust, authentication, OS and sudo.
 */
@Component
public class PreflightRunner {
    private final ExecutionStore store;
    private final MachineRepository machines;
    private final CredentialRepository credentials;
    private final StepResolver resolver;
    private final MachineConnectionService connections;
    private final ExecutionEventPublisher events;
    private final boolean requireRhel;

    public PreflightRunner(ExecutionStore store, MachineRepository machines, CredentialRepository credentials, StepResolver resolver,
                           MachineConnectionService connections, ExecutionEventPublisher events,
                           @Value("${autoops.execution.require-rhel:true}") boolean requireRhel) {
        this.store = store;
        this.machines = machines;
        this.credentials = credentials;
        this.resolver = resolver;
        this.connections = connections;
        this.events = events;
        this.requireRhel = requireRhel;
    }

    public boolean run(Execution e, ExecutionPlan plan, MachineRun mr) {
        PreflightRun p = store.startPreflight(mr.getId());
        events.publish(e.getId(), "MACHINE_STARTED", Map.of("machineRunId", mr.getId(), "machineId", mr.getMachineId()));
        events.publish(e.getId(), "PREFLIGHT_STARTED", Map.of("machineRunId", mr.getId()));
        String failure = check(e, plan, mr, p);
        p.setFinishedAt(Instant.now());
        p.setStatus(failure == null ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED);
        p.setFailureReason(failure);
        store.savePreflight(p);
        if (failure == null) {
            store.setMachineStatus(mr.getId(), ExecutionStatus.PENDING);
            events.publish(e.getId(), "PREFLIGHT_COMPLETED", Map.of("machineRunId", mr.getId(), "status", "SUCCESS"));
            return true;
        }
        store.finishMachine(mr.getId(), ExecutionStatus.FAILED, "Preflight failed: " + failure);
        events.publish(e.getId(), "PREFLIGHT_FAILED", Map.of("machineRunId", mr.getId(), "reason", failure));
        events.publish(e.getId(), "MACHINE_COMPLETED", Map.of("machineRunId", mr.getId(), "status", ExecutionStatus.FAILED));
        return false;
    }

    private String check(Execution e, ExecutionPlan plan, MachineRun mr, PreflightRun p) {
        Machine machine = machines.findById(mr.getMachineId())
                .filter(m -> m.getDeletedAt() == null && e.getStartedBy().equals(m.getCreatedBy())).orElse(null);
        if (machine == null) {
            skipRemote(p);
            return "Machine is no longer available";
        }
        Credential credential = mr.getCredentialId() == null ? null : credentials.findById(mr.getCredentialId())
                .filter(c -> c.getDeletedAt() == null && e.getStartedBy().equals(c.getCreatedBy())).orElse(null);
        if (credential == null) {
            skipRemote(p);
            return "No usable credential for this machine";
        }

        List<ResolvedStep> resolved = new ArrayList<>();
        p.setParametersStatus("SUCCESS");
        p.setFilesStatus("NOT_REQUIRED");
        for (PlanStep step : plan.steps()) {
            boolean isFile = "FILE_TRANSFER".equals(step.definition().type());
            try {
                resolved.add(resolver.resolve(step, e.getStartedBy()));
                if (isFile && !"FAILED".equals(p.getFilesStatus())) {
                    p.setFilesStatus("SUCCESS");
                }
            } catch (ApiException ex) {
                if (isFile) {
                    p.setFilesStatus("FAILED");
                } else {
                    p.setParametersStatus("FAILED");
                }
                skipRemote(p);
                return "Step '" + step.name() + "': " + ex.getMessage() + details(ex);
            }
        }
        boolean needsSudo = resolved.stream().anyMatch(ResolvedStep::runWithSudo);

        if (!machine.isTrusted()) {
            p.setHostVerificationStatus("UNTRUSTED");
            p.setSshStatus("NOT_CHECKED");
            p.setAuthenticationStatus("NOT_CHECKED");
            p.setOsStatus("NOT_CHECKED");
            p.setSudoStatus("NOT_CHECKED");
            return "SSH host key is not trusted. Discover and confirm the machine's fingerprint first.";
        }
        try (RemoteSession session = connections.connect(machine, credential)) {
            p.setSshStatus("SUCCESS");
            p.setHostVerificationStatus("SUCCESS");
            p.setAuthenticationStatus("SUCCESS");
            ExecResult os = session.exec(ShellCommands.OS_RELEASE, 15);
            OsInfo info = OsInfo.parse(os.stdout());
            if (!os.success() || !info.known()) {
                p.setOsStatus("FAILED");
                p.setSudoStatus("NOT_CHECKED");
                return "Could not detect the operating system";
            }
            if (!info.rhelFamily()) {
                if (requireRhel) {
                    p.setOsStatus("FAILED");
                    p.setSudoStatus("NOT_CHECKED");
                    return "Unsupported operating system: " + info.display() + " (RHEL family required)";
                }
                p.setOsStatus("WARNING");
            } else {
                p.setOsStatus("SUCCESS");
            }
            if (needsSudo) {
                ExecResult sudo = session.exec(ShellCommands.SUDO_CHECK, connections.sudoPassword(credential), 20, () -> false, null);
                p.setSudoStatus(sudo.success() ? "SUCCESS" : "FAILED");
                if (!sudo.success()) {
                    return "Privilege escalation (sudo) is not available with this credential";
                }
            } else {
                p.setSudoStatus("NOT_REQUIRED");
            }
            return null;
        } catch (RemoteException ex) {
            switch (ex.kind()) {
                case HOST_KEY_MISMATCH -> {
                    p.setSshStatus("SUCCESS");
                    p.setHostVerificationStatus("MISMATCH");
                    p.setAuthenticationStatus("NOT_CHECKED");
                }
                case UNTRUSTED_HOST -> p.setHostVerificationStatus("UNTRUSTED");
                case AUTHENTICATION_FAILED -> {
                    p.setSshStatus("SUCCESS");
                    p.setHostVerificationStatus("SUCCESS");
                    p.setAuthenticationStatus("FAILED");
                }
                default -> p.setSshStatus("FAILED");
            }
            if (p.getOsStatus() == null) {
                p.setOsStatus("NOT_CHECKED");
            }
            if (p.getSudoStatus() == null) {
                p.setSudoStatus("NOT_CHECKED");
            }
            return ex.getMessage();
        }
    }

    private static String details(ApiException ex) {
        if (ex.fieldErrors().isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(" (");
        ex.fieldErrors().forEach((k, v) -> sb.append(k).append(": ").append(v).append("; "));
        sb.setLength(sb.length() - 2);
        return sb.append(')').toString();
    }

    private static void skipRemote(PreflightRun p) {
        p.setSshStatus("NOT_CHECKED");
        p.setHostVerificationStatus("NOT_CHECKED");
        p.setAuthenticationStatus("NOT_CHECKED");
        p.setOsStatus("NOT_CHECKED");
        p.setSudoStatus("NOT_CHECKED");
    }
}
