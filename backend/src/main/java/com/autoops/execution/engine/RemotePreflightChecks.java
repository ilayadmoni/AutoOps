package com.autoops.execution.engine;

import com.autoops.credential.entity.Credential;
import com.autoops.execution.entity.PreflightRun;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.infrastructure.remote.ExecResult;
import com.autoops.infrastructure.remote.OsFamily;
import com.autoops.infrastructure.remote.OsInfo;
import com.autoops.infrastructure.remote.RemoteException;
import com.autoops.infrastructure.remote.RemoteSession;
import com.autoops.infrastructure.remote.ShellCommands;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineConnectionService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/** SSH, Linux compatibility and sudo checks shared by machine preflight. */
@Component
public class RemotePreflightChecks {
    private final MachineConnectionService connections;

    public RemotePreflightChecks(MachineConnectionService connections) {
        this.connections = connections;
    }

    public String check(Machine machine, Credential credential, List<ResolvedStep> resolved, PreflightRun p) {
        boolean needsSudo = resolved.stream().anyMatch(ResolvedStep::runWithSudo);
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
            String osProblem = osProblem(info, resolved);
            if (osProblem != null) {
                p.setOsStatus("FAILED");
                p.setSudoStatus("NOT_CHECKED");
                return osProblem;
            }
            p.setOsStatus("SUCCESS");
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

    /** Any Linux is accepted; each step must support the machine's distribution family. */
    static String osProblem(OsInfo info, List<ResolvedStep> resolved) {
        Optional<OsFamily> family = info.family();
        for (ResolvedStep step : resolved) {
            if (!OsFamily.compatible(step.supportedOs(), family)) {
                String needs = step.supportedOs().stream().map(Enum::name).sorted().collect(Collectors.joining(" or "));
                return "Step '" + step.step().name() + "' runs only on " + needs + " family systems; this machine is "
                        + info.display() + family.map(f -> " (" + f.name() + " family)").orElse(" (unknown family)");
            }
        }
        return null;
    }

}
