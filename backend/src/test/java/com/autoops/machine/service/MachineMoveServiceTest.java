package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MachineMoveServiceTest {
    private final MachineRepository repo = mock(MachineRepository.class);
    private final MachineFolderService folders = mock(MachineFolderService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AuditService audit = mock(AuditService.class);
    private final MachineMoveService service = new MachineMoveService(repo, folders, jdbc, audit);

    @Test void movesOnlyFolderMembershipAndDeduplicatesIds() {
        Machine m = machine(1L);
        when(repo.findActiveForUpdate(1L)).thenReturn(Optional.of(m));
        var result = service.move(7L, List.of(1L, 1L), 9L);
        assertEquals(1, result.size());
        assertEquals(9L, m.getFolderId());
        assertEquals("existing.example", m.getHostname());
        assertEquals(12L, m.getPreferredCredentialId());
        verify(repo, times(1)).findActiveForUpdate(1L);
    }

    @Test void validatesAllMachinesBeforeMovingAny() {
        Machine m = machine(1L);
        when(repo.findActiveForUpdate(1L)).thenReturn(Optional.of(m));
        when(repo.findActiveForUpdate(2L)).thenReturn(Optional.empty());
        assertThrows(ApiException.class, () -> service.move(7L, List.of(1L, 2L), 9L));
        assertEquals(8L, m.getFolderId());
        verifyNoInteractions(audit);
    }

    @Test void acceptsRootAndRejectsMissingDestinationsBeforeUpdating() {
        Machine m = machine(1L);
        when(repo.findActiveForUpdate(1L)).thenReturn(Optional.of(m));
        service.move(7L, List.of(1L), null);
        assertNull(m.getFolderId());
        doThrow(ApiException.notFound("Folder")).when(folders).requireExists(99L);
        assertThrows(ApiException.class, () -> service.move(7L, List.of(1L), 99L));
        assertNull(m.getFolderId());
    }

    private Machine machine(Long id) {
        Machine m = new Machine();
        ReflectionTestUtils.setField(m, "id", id);
        m.setName("Existing"); m.setHostname("existing.example");
        m.setFolderId(8L); m.setPreferredCredentialId(12L);
        return m;
    }
}
