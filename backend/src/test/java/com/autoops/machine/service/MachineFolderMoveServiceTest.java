package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.machine.entity.MachineFolder;
import com.autoops.machine.repository.MachineFolderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MachineFolderMoveServiceTest {
    private final MachineFolderRepository repo = mock(MachineFolderRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AuditService audit = mock(AuditService.class);
    private final MachineFolderMoveService service = new MachineFolderMoveService(repo, jdbc, audit);
    private final MachineFolder root = folder(1L, "Lab", "Lab", null);
    private final MachineFolder child = folder(2L, "Apps", "Lab/Apps", 1L);
    private final MachineFolder destination = folder(3L, "Production", "Production", null);

    private void setup() {
        when(repo.findById(1L)).thenReturn(Optional.of(root));
        when(repo.findById(2L)).thenReturn(Optional.of(child));
        when(repo.findById(3L)).thenReturn(Optional.of(destination));
        when(repo.findAllByOrderByPathAsc()).thenReturn(List.of(root, child, destination));
    }

    @Test void movesTheWholeSubtreeWhileKeepingIdsAndChildParentLinks() {
        setup();
        service.move(7L, 1L, 3L);
        assertEquals("Production/Lab", root.getPath());
        assertEquals(3L, root.getParentId());
        assertEquals("Production/Lab/Apps", child.getPath());
        assertEquals(1L, child.getParentId());
        assertEquals(2L, child.getId());
        verify(repo).flush();
        verify(jdbc).execute(MachineFolderLock.SQL);
    }

    @Test void rejectsSelfAndDescendantDestinationsBeforeMutating() {
        setup();
        assertThrows(ApiException.class, () -> service.move(7L, 1L, 1L));
        assertThrows(ApiException.class, () -> service.move(7L, 1L, 2L));
        assertEquals("Lab", root.getPath());
        verify(repo, never()).flush();
    }

    @Test void rejectsNameConflictsWithoutMergingOrChangingTheSource() {
        setup();
        MachineFolder conflict = folder(4L, "Lab", "Production/Lab", 3L);
        when(repo.findAllByOrderByPathAsc()).thenReturn(List.of(root, child, destination, conflict));
        assertThrows(ApiException.class, () -> service.move(7L, 1L, 3L));
        assertEquals("Lab", root.getPath());
        assertEquals("Lab/Apps", child.getPath());
        verify(repo, never()).flush();
    }

    @Test void supportsMovingBackToRootAndTreatsTheSameParentAsNoOp() {
        setup();
        service.move(7L, 1L, null);
        verify(repo, never()).flush();
        root.moveTo("Production/Lab", 3L);
        child.moveTo("Production/Lab/Apps", 1L);
        service.move(7L, 1L, null);
        assertEquals("Lab", root.getPath());
        assertNull(root.getParentId());
        assertEquals("Lab/Apps", child.getPath());
    }

    private static MachineFolder folder(Long id, String name, String path, Long parentId) {
        MachineFolder f = new MachineFolder(name, path, parentId);
        ReflectionTestUtils.setField(f, "id", id);
        return f;
    }
}
