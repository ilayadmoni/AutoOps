package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.infrastructure.remote.RemoteClient;
import com.autoops.infrastructure.remote.SshHostKey;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SshHostTrustServiceTest {
    private final MachineRepository machines = mock(MachineRepository.class);
    private final RemoteClient remote = mock(RemoteClient.class);
    private final AuditService audit = mock(AuditService.class);
    private final SshHostTrustService service = new SshHostTrustService(
            machines, mock(MachineService.class), remote, audit);

    @Test
    void pinsFirstObservedKeyBeforeAuthentication() {
        Machine machine = machine();
        when(machines.findActiveForUpdate(10L)).thenReturn(Optional.of(machine));
        when(remote.discoverHostKey("host", 22)).thenReturn(new SshHostKey("ssh-ed25519", "key", "SHA256:test"));
        when(machines.save(machine)).thenReturn(machine);

        Machine result = service.trustOnFirstUse(2L, 10L);

        assertSame(machine, result);
        assertEquals("SHA256:test", result.getSshFingerprint());
        verify(machines).save(machine);
        verify(audit).record(eq(2L), eq("SSH_TRUST_AUTO_CONFIRMED"), eq("MACHINE"), eq(10L), anyMap());
    }

    @Test
    void revokedMachineCannotBePinnedAgain() {
        Machine machine = machine();
        machine.clearTrust();
        when(machines.findActiveForUpdate(10L)).thenReturn(Optional.of(machine));

        assertSame(machine, service.trustOnFirstUse(2L, 10L));
        verifyNoInteractions(remote, audit);
        verify(machines, never()).save(any());
    }

    private Machine machine() {
        Machine machine = new Machine();
        ReflectionTestUtils.setField(machine, "id", 10L);
        machine.setHostname("host");
        machine.setSshPort(22);
        return machine;
    }
}
