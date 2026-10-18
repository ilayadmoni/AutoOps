package com.autoops.execution.engine;

import com.autoops.credential.entity.Credential;
import com.autoops.credential.repository.CredentialRepository;
import com.autoops.execution.entity.Execution;
import com.autoops.execution.entity.MachineRun;
import com.autoops.execution.entity.PreflightRun;
import com.autoops.execution.plan.ExecutionPlan;
import com.autoops.execution.plan.StepResolver;
import com.autoops.execution.realtime.ExecutionEventPublisher;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import com.autoops.machine.service.SshHostTrustService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PreflightRunnerTest {
    private final ExecutionStore store = mock(ExecutionStore.class);
    private final MachineRepository machines = mock(MachineRepository.class);
    private final CredentialRepository credentials = mock(CredentialRepository.class);
    private final RemotePreflightChecks remote = mock(RemotePreflightChecks.class);
    private final SshHostTrustService trust = mock(SshHostTrustService.class);
    private final PreflightRunner runner = new PreflightRunner(store, machines, credentials,
            mock(StepResolver.class), remote, trust, mock(ExecutionEventPublisher.class));
    private final ExecutionPlan plan = new ExecutionPlan(List.of(), null);

    @Test
    void sharedMachineAndCredentialPassPreflightForAnotherUser() {
        Execution execution = execution();
        MachineRun run = machineRun();
        Machine machine = new Machine();
        machine.setCreatedBy(1L);
        machine.trust("ssh-ed25519", "key", "fingerprint");
        Credential credential = new Credential();
        credential.setCreatedBy(1L);
        when(machines.findById(10L)).thenReturn(Optional.of(machine));
        when(credentials.findById(20L)).thenReturn(Optional.of(credential));
        when(store.startPreflight(30L)).thenReturn(new PreflightRun());

        assertTrue(runner.run(execution, plan, run));
        verify(remote).check(eq(machine), eq(credential), eq(List.of()), any(PreflightRun.class));
        verify(store).setMachineStatus(30L, "PENDING");
    }

    @Test
    void deletedSharedMachineStillFailsPreflight() {
        Machine machine = new Machine();
        machine.setCreatedBy(1L);
        machine.setDeletedAt(Instant.now());
        when(machines.findById(10L)).thenReturn(Optional.of(machine));
        when(store.startPreflight(30L)).thenReturn(new PreflightRun());

        assertFalse(runner.run(execution(), plan, machineRun()));
        verifyNoInteractions(remote);
        verify(store).finishMachine(30L, "FAILED", "Preflight failed: Machine is no longer available");
    }

    @Test
    void firstUsePinsHostKeyBeforeRemoteChecks() {
        Machine machine = new Machine();
        machine.setCreatedBy(1L);
        Machine trusted = new Machine();
        trusted.trust("ssh-ed25519", "key", "fingerprint");
        Credential credential = new Credential();
        when(machines.findById(10L)).thenReturn(Optional.of(machine));
        when(credentials.findById(20L)).thenReturn(Optional.of(credential));
        when(store.startPreflight(30L)).thenReturn(new PreflightRun());
        when(trust.trustOnFirstUse(2L, 10L)).thenReturn(trusted);

        assertTrue(runner.run(execution(), plan, machineRun()));
        var order = inOrder(trust, remote);
        order.verify(trust).trustOnFirstUse(2L, 10L);
        order.verify(remote).check(eq(trusted), eq(credential), eq(List.of()), any(PreflightRun.class));
    }

    @Test
    void explicitRevocationDoesNotAutoTrustAgain() {
        Machine machine = new Machine();
        machine.clearTrust();
        when(machines.findById(10L)).thenReturn(Optional.of(machine));
        when(credentials.findById(20L)).thenReturn(Optional.of(new Credential()));
        when(store.startPreflight(30L)).thenReturn(new PreflightRun());

        assertFalse(runner.run(execution(), plan, machineRun()));
        verifyNoInteractions(trust, remote);
    }

    private Execution execution() {
        Execution execution = mock(Execution.class);
        when(execution.getId()).thenReturn(40L);
        when(execution.getStartedBy()).thenReturn(2L);
        return execution;
    }

    private MachineRun machineRun() {
        MachineRun run = mock(MachineRun.class);
        when(run.getId()).thenReturn(30L);
        when(run.getMachineId()).thenReturn(10L);
        when(run.getCredentialId()).thenReturn(20L);
        return run;
    }
}
