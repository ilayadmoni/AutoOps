package com.autoops.machine.service;

import com.autoops.common.error.ApiException;
import com.autoops.machine.dto.MachineImportDtos.*;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MachineImportServiceTest {
    private final MachineRepository repo = mock(MachineRepository.class);
    private final MachineImportRowService writer = mock(MachineImportRowService.class);
    private final MachineImportService service = new MachineImportService(new MobaSessionParser(), repo, writer);
    private byte[] file(String entries) { return ("[Bookmarks]\nSubRep=Lab\n" + entries).getBytes(StandardCharsets.UTF_8); }
    private String session(String name, String host) { return MobaSessionParserTest.session(name, "0", host, "22", "ops"); }

    @Test void deduplicatesExistingAndFileEntriesCaseInsensitivelyIncludingIpv6() {
        Machine existing = new Machine(); existing.setHostname("APP.EXAMPLE");
        when(repo.findByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of(existing));
        var rows = service.preview(file(session("Existing", "app.example.") + session("New", "new.example")
                + session("Again", "NEW.EXAMPLE") + session("IPv6", "2001:db8::1")
                + session("IPv6 repeated", "2001:db8:0:0:0:0:0:1"))).rows();
        assertEquals("DUPLICATE", rows.get(0).skipReason());
        assertNull(rows.get(1).skipReason());
        assertEquals("DUPLICATE", rows.get(2).skipReason());
        assertNull(rows.get(3).skipReason());
        assertEquals("DUPLICATE", rows.get(4).skipReason());
        verifyNoInteractions(writer);
    }

    @Test void respectsSelectionSkipsWindowsAndContinuesAfterRowFailure() {
        when(repo.findByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of());
        when(writer.create(eq(7L), argThat(r -> r.index() == 0), any()))
                .thenReturn(new Outcome(0, "Good", "IMPORTED", null, 91L));
        when(writer.create(eq(7L), argThat(r -> r.index() == 1), any())).thenThrow(new RuntimeException("PRIVATE DATA"));
        var result = service.execute(7L, file(session("Good", "one") + session("Fails", "two")
                + session("Not chosen", "three") + MobaSessionParserTest.session("Windows", "4", "four", "3389", "u")),
                new Request(List.of(new Selection(0, null), new Selection(1, null), new Selection(3, null))));
        assertEquals(1, result.imported());
        assertEquals(2, result.skipped());
        assertEquals(1, result.failed());
        assertEquals("IMPORT_FAILED", result.outcomes().get(1).reason());
        assertEquals("NOT_SELECTED", result.outcomes().get(2).reason());
        assertEquals("WINDOWS", result.outcomes().get(3).reason());
        assertFalse(result.toString().contains("PRIVATE DATA"));
        verify(writer, times(2)).create(eq(7L), any(), any());
    }

    @Test void rejectsInvalidAndRepeatedSelectionsBeforeWritingAnything() {
        when(repo.findByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of());
        byte[] file = file(session("VM", "host"));
        assertThrows(ApiException.class, () -> service.execute(1L, file, new Request(List.of(new Selection(9, null)))));
        assertThrows(ApiException.class, () -> service.execute(1L, file, new Request(List.of(new Selection(0, null), new Selection(0, null)))));
        verifyNoInteractions(writer);
    }
}
