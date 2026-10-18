package com.autoops.execution.engine;

import com.autoops.credential.entity.Credential;
import com.autoops.execution.entity.PreflightRun;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.ResolvedStep;
import com.autoops.infrastructure.remote.*;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineConnectionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RemotePreflightChecksTest {
    @ParameterizedTest
    @ValueSource(strings = {"ubuntu", "debian", "fedora", "opensuse", "arch", "alpine", "gentoo", "nixos"})
    void acceptsLinuxDistributionsIncludingUnknownFamilies(String distribution) {
        var connections = mock(MachineConnectionService.class);
        var session = mock(RemoteSession.class);
        var machine = new Machine();
        var credential = new Credential();
        when(connections.connect(machine, credential)).thenReturn(session);
        when(session.exec(ShellCommands.OS_RELEASE, 15))
                .thenReturn(new ExecResult(0, "ID=" + distribution + "\n", "", false, false));
        var preflight = new PreflightRun();

        assertNull(new RemotePreflightChecks(connections).check(machine, credential,
                List.of(step(OsFamily.LINUX)), preflight));
        assertEquals("SUCCESS", preflight.getOsStatus());
        assertEquals("NOT_REQUIRED", preflight.getSudoStatus());
        verify(session).close();
    }

    @Test
    void keepsDistributionSpecificCommandsOnCompatibleHosts() {
        assertNull(RemotePreflightChecks.osProblem(OsInfo.parse("ID=fedora"), List.of(step(OsFamily.RPM))));
        assertNotNull(RemotePreflightChecks.osProblem(OsInfo.parse("ID=ubuntu"), List.of(step(OsFamily.RPM))));
        assertNotNull(RemotePreflightChecks.osProblem(OsInfo.parse("ID=gentoo"), List.of(step(OsFamily.DEBIAN))));
        assertNull(RemotePreflightChecks.osProblem(OsInfo.parse("ID=alpine"), List.of(step(OsFamily.ALPINE))));
    }

    @Test
    void failsWhenTheOperatingSystemCannotBeDetected() {
        var connections = mock(MachineConnectionService.class);
        var session = mock(RemoteSession.class);
        var machine = new Machine();
        var credential = new Credential();
        when(connections.connect(machine, credential)).thenReturn(session);
        when(session.exec(ShellCommands.OS_RELEASE, 15)).thenReturn(new ExecResult(1, "", "missing", false, false));
        var preflight = new PreflightRun();
        assertNotNull(new RemotePreflightChecks(connections).check(machine, credential,
                List.of(step(OsFamily.LINUX)), preflight));
        assertEquals("FAILED", preflight.getOsStatus());
        assertEquals("NOT_CHECKED", preflight.getSudoStatus());
    }

    private ResolvedStep step(OsFamily family) {
        var plan = new PlanStep("test", null, "Test command", false, null, null, null);
        return new ResolvedStep(plan, "COMMAND", "test", "test", "LOW", false, 30, null, null, Set.of(family));
    }
}
