package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.credential.entity.Credential;
import com.autoops.credential.service.CredentialManagementService;
import com.autoops.infrastructure.remote.ExecResult;
import com.autoops.infrastructure.remote.OsInfo;
import com.autoops.infrastructure.remote.RemoteException;
import com.autoops.infrastructure.remote.RemoteSession;
import com.autoops.infrastructure.remote.ShellCommands;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/** Safe, read-only connection test: host verification, authentication, OS detection and sudo availability. */
@Service
public class MachineTestService {
    private final MachineService machineService;
    private final MachineRepository machines;
    private final CredentialManagementService credentials;
    private final MachineConnectionService connections;
    private final AuditService audit;

    public MachineTestService(MachineService machineService, MachineRepository machines, CredentialManagementService credentials,
                              MachineConnectionService connections, AuditService audit) {
        this.machineService = machineService;
        this.machines = machines;
        this.credentials = credentials;
        this.connections = connections;
        this.audit = audit;
    }

    public record TestResult(String ssh, String hostVerification, String authentication, String os, String sudo,
                             String osName, String osVersion, String osFamily, String message) {
    }

    public TestResult test(Long userId, Long machineId, Long credentialId, boolean checkSudo) {
        Machine m = machineService.requireOwned(userId, machineId);
        Long credId = credentialId != null ? credentialId : m.getPreferredCredentialId();
        if (credId == null) {
            throw ApiException.validation("Select a credential or set a preferred credential for this machine",
                    Map.of("credentialId", "Required"));
        }
        Credential c = credentials.requireOwned(userId, credId);
        TestResult result = run(m, c, checkSudo);
        m = machines.findById(m.getId()).orElseThrow();
        m.setLastTestStatus("SUCCESS".equals(result.authentication()) && "SUCCESS".equals(result.os()) ? "SUCCESS" : "FAILED");
        m.setLastTestedAt(Instant.now());
        if ("SUCCESS".equals(result.os()) && result.osName() != null) {
            m.setOperatingSystem(result.osName());
            m.setOsVersion(result.osVersion());
        }
        machines.save(m);
        audit.record(userId, "MACHINE_TESTED", "MACHINE", m.getId(), Map.of("result", m.getLastTestStatus(), "hostVerification", result.hostVerification()));
        return result;
    }

    private TestResult run(Machine m, Credential c, boolean checkSudo) {
        try (RemoteSession session = connections.connect(m, c)) {
            ExecResult os = session.exec(ShellCommands.OS_RELEASE, 15);
            OsInfo info = OsInfo.parse(os.stdout());
            String osStatus = os.success() && info.known() ? "SUCCESS" : "FAILED";
            String sudo = "NOT_CHECKED";
            String sudoDetail = "";
            if (checkSudo) {
                ExecResult s = session.exec(ShellCommands.SUDO_CHECK, connections.sudoPassword(c), 20, () -> false, null);
                sudo = s.success() ? "SUCCESS" : "FAILED";
                if (!s.success()) {
                    String firstLine = s.stderr().strip().lines().findFirst().orElse("exit code " + s.exitCode());
                    sudoDetail = " Sudo check failed: " + (firstLine.length() > 160 ? firstLine.substring(0, 160) : firstLine);
                }
            }
            String message = ("SUCCESS".equals(osStatus)
                    ? "Connected to " + info.display()
                    : "Connected, but the operating system could not be detected") + sudoDetail;
            return new TestResult("SUCCESS", "SUCCESS", "SUCCESS", osStatus, sudo,
                    info.known() ? info.name() : null, info.known() ? info.versionId() : null,
                    info.family().map(Enum::name).orElse(null), message);
        } catch (RemoteException e) {
            return switch (e.kind()) {
                case UNTRUSTED_HOST -> new TestResult("NOT_CHECKED", "UNTRUSTED", "NOT_CHECKED", "NOT_CHECKED", "NOT_CHECKED", null, null, null, e.getMessage());
                case HOST_KEY_MISMATCH -> new TestResult("SUCCESS", "MISMATCH", "NOT_CHECKED", "NOT_CHECKED", "NOT_CHECKED", null, null, null, e.getMessage());
                case AUTHENTICATION_FAILED -> new TestResult("SUCCESS", "SUCCESS", "FAILED", "NOT_CHECKED", "NOT_CHECKED", null, null, null, e.getMessage());
                default -> new TestResult("FAILED", "NOT_CHECKED", "NOT_CHECKED", "NOT_CHECKED", "NOT_CHECKED", null, null, null, e.getMessage());
            };
        }
    }
}
