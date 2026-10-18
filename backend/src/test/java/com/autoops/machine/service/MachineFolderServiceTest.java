package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.machine.entity.MachineFolder;
import com.autoops.machine.repository.MachineFolderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MachineFolderServiceTest {
    private final MachineFolderRepository repo = mock(MachineFolderRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AuditService audit = mock(AuditService.class);
    private final MachineFolderService service = new MachineFolderService(repo, jdbc, audit);

    @Test
    void deletesSubfoldersAndMovesMachinesToParentWithoutDeletingMachines() {
        MachineFolder root = folder(2L, "Lab", "Lab", 1L);
        MachineFolder child = folder(3L, "Apps", "Lab/Apps", 2L);
        MachineFolder sibling = folder(4L, "Other", "Lab-other", null);
        when(repo.findById(2L)).thenReturn(Optional.of(root));
        when(repo.findAllByOrderByPathAsc()).thenReturn(List.of(root, child, sibling));

        service.delete(7L, 2L);

        var order = inOrder(jdbc, repo);
        order.verify(jdbc).update("UPDATE machines SET folder_id = ? WHERE folder_id = ?", 1L, 3L);
        order.verify(repo).delete(child);
        order.verify(repo).flush();
        order.verify(jdbc).update("UPDATE machines SET folder_id = ? WHERE folder_id = ?", 1L, 2L);
        order.verify(repo).delete(root);
        verify(repo, never()).delete(sibling);
        verify(audit).record(eq(7L), eq("MACHINE_FOLDER_DELETED"), eq("MACHINE_FOLDER"), eq(2L), anyMap());
    }

    private MachineFolder folder(Long id, String name, String path, Long parentId) {
        MachineFolder folder = new MachineFolder(name, path, parentId);
        ReflectionTestUtils.setField(folder, "id", id);
        return folder;
    }
}
