package com.autoops.ai.service;

import com.autoops.common.error.ApiException;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.service.StoredFileService;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatAttachmentsTest {
    private final StoredFileService files = mock(StoredFileService.class);
    private final MachineService machines = mock(MachineService.class);
    private final ChatAttachments attachments = new ChatAttachments(files, machines, new ObjectMapper());

    @Test
    void resolvesDistinctIdsWithExistingAccessChecks() {
        Machine machine = mock(Machine.class);
        when(machine.getId()).thenReturn(8L);
        when(machine.getName()).thenReturn("Production API");
        when(machine.getHostname()).thenReturn("api.example");
        when(machines.requireOwned(1L, 8L)).thenReturn(machine);
        StoredFile file = mock(StoredFile.class);
        when(file.getId()).thenReturn(31L);
        when(file.getOriginalFilename()).thenReturn("deploy.sh");
        when(file.getSize()).thenReturn(2048L);
        when(files.requireUsable(1L, 31L)).thenReturn(file);
        String context = attachments.context(1L, List.of(31L, 31L), List.of(8L, 8L));
        assertTrue(context.contains("\"id\":8"));
        assertTrue(context.contains("Production API"));
        assertTrue(context.contains("- 31: deploy.sh, 2048 bytes"));
        assertTrue(context.indexOf("Attached servers") < context.indexOf("Attached files"));
        verify(machines, times(1)).requireOwned(1L, 8L);
        verify(files, times(1)).requireUsable(1L, 31L);
    }

    @Test
    void rejectsUnavailableServersAndInvalidIds() {
        when(machines.requireOwned(1L, 9L)).thenThrow(ApiException.notFound("Machine"));
        assertThrows(ApiException.class, () -> attachments.context(1L, null, List.of(9L)));
        assertThrows(ApiException.class, () -> attachments.context(1L, null, List.of(-1L)));
        assertThrows(ApiException.class, () -> attachments.context(1L, Collections.singletonList(null), null));
    }

    @Test
    void rejectsOversizedSelectionsAndPreservesRequestsWithoutAttachments() {
        assertThrows(ApiException.class, () -> attachments.context(1L, Collections.nCopies(6, 31L), null));
        assertThrows(ApiException.class, () -> attachments.context(1L, null, Collections.nCopies(21, 8L)));
        assertEquals("", attachments.context(1L, null, null));
        verifyNoInteractions(machines, files);
    }
}
