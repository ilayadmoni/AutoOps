package com.autoops.files.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.files.entity.StoredFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FolderPackageServiceTest {
    private final StoredFileUpload uploads = mock(StoredFileUpload.class);
    private final StoredFileService files = mock(StoredFileService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AuditService audit = mock(AuditService.class);
    private final ObjectMapper json = new ObjectMapper();
    private final FolderPackageService service = new FolderPackageService(uploads, files, json, jdbc, audit);

    @Test
    void refusesToEditPackageUsedByWorkflow() {
        when(files.get(7L, 4L)).thenReturn(view(List.of("Deploy")));

        assertThatThrownBy(() -> service.deleteSubfolder(7L, 4L, "logs"))
                .isInstanceOf(ApiException.class).hasMessageContaining("workflow");
        verifyNoInteractions(uploads, jdbc);
        verify(files, never()).delete(anyLong(), anyLong());
    }

    @Test
    void createsReplacementAndDeletesOldPackageAfterSuccessfulArchiveEdit() throws Exception {
        var request = new FolderManifest.Request("app", List.of("logs/old.txt", "bin/run.sh"), List.of());
        var parts = List.of(file("old"), file("run"));
        try (var original = FolderArchive.build(request, List.copyOf(parts), 10000)) {
            StoredFile stored = stored(original.entries());
            StoredFile replacement = new StoredFile();
            ReflectionTestUtils.setField(replacement, "id", 9L);
            when(files.get(7L, 4L)).thenReturn(view(List.of()));
            when(files.requireUsable(7L, 4L)).thenReturn(stored);
            when(files.open(stored)).thenAnswer(call -> Files.newInputStream(original.path()));
            when(uploads.store(any(), eq(7L), eq("app"), anyString(), eq(1))).thenReturn(replacement);

            service.deleteSubfolder(7L, 4L, "logs");

            verify(uploads).store(any(), eq(7L), eq("app"), argThat(s -> s.contains("bin/run.sh") && !s.contains("logs/")), eq(1));
            verify(files).delete(7L, 4L);
            verify(jdbc).update("UPDATE user_favorites SET item_id = ? WHERE collection = 'files' AND item_id = ?", 9L, 4L);
        }
    }

    @Test
    void deletesPackageWhenItsLastDirectoryIsRemoved() throws Exception {
        var entries = List.of(new FolderManifest.Entry("logs/old.txt", 3, "checksum", false));
        when(files.get(7L, 4L)).thenReturn(view(List.of()));
        when(files.requireUsable(7L, 4L)).thenReturn(stored(entries));

        service.deleteSubfolder(7L, 4L, "logs");

        verify(files).delete(7L, 4L);
        verifyNoInteractions(uploads);
    }

    private StoredFileService.FileView view(List<String> references) {
        return new StoredFileService.FileView(4L, "app.tar.gz", 10, "checksum", "application/gzip", null,
                references, "app", 2);
    }

    private StoredFile stored(List<FolderManifest.Entry> entries) throws Exception {
        StoredFile stored = new StoredFile();
        stored.setOriginalFilename("app.tar.gz");
        stored.setFolderName("app");
        stored.setFolderManifest(json.writeValueAsString(entries));
        return stored;
    }

    private MockMultipartFile file(String text) {
        return new MockMultipartFile("files", "ignored", "text/plain", text.getBytes());
    }
}
