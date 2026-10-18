package com.autoops.files.service;

import com.autoops.audit.service.AuditService;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.repository.StoredFileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import java.io.InputStream;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StoredFileUploadTest {
    final StoredFileRepository repo = mock(StoredFileRepository.class);
    final ObjectStorageService storage = mock(ObjectStorageService.class);
    final StoredFileUpload uploads = new StoredFileUpload(repo, storage, mock(AuditService.class), DataSize.ofMegabytes(1));
    final MockMultipartFile part = new MockMultipartFile("file", "app.tar.gz", "application/gzip", new byte[]{1, 2, 3});

    @Test void identicalFolderUploadsCreateIndependentImmutableVersions() {
        doAnswer(call -> { ((InputStream) call.getArgument(1)).transferTo(java.io.OutputStream.nullOutputStream()); return null; })
                .when(storage).put(anyString(), any(), anyLong(), anyString());
        when(repo.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        StoredFile first = uploads.store(part, 1L, "app", "[]", 1);
        StoredFile second = uploads.store(part, 1L, "app", "[]", 1);
        assertThat(first).isNotSameAs(second);
        assertThat(first.getChecksum()).isEqualTo(second.getChecksum()).hasSize(64);
        assertThat(first.getObjectKey()).isNotEqualTo(second.getObjectKey());
        assertThat(first.getFolderName()).isEqualTo("app");
        verify(repo, never()).findFirstByOriginalFilenameAndChecksumAndFolderNameIsNullAndDeletedAtIsNullOrderByIdAsc(any(), any());
    }
    @Test void ordinaryFilesStillReuseTheMatchingExistingFile() {
        StoredFile existing = new StoredFile();
        when(repo.findFirstByOriginalFilenameAndChecksumAndFolderNameIsNullAndDeletedAtIsNullOrderByIdAsc(any(), any())).thenReturn(Optional.of(existing));
        assertThat(uploads.store(part, 1L, null, null, 0)).isSameAs(existing);
        verify(storage).delete(anyString()); verify(repo, never()).saveAndFlush(any());
    }
    @Test void failedMetadataSaveRemovesTheUploadedObject() {
        when(repo.saveAndFlush(any())).thenThrow(new IllegalStateException("database unavailable"));
        assertThatThrownBy(() -> uploads.store(part, 1L, "app", "[]", 1)).isInstanceOf(IllegalStateException.class);
        verify(storage).delete(anyString());
    }
    @Test void failedDuplicateLookupAlsoRemovesTheUploadedObject() {
        when(repo.findFirstByOriginalFilenameAndChecksumAndFolderNameIsNullAndDeletedAtIsNullOrderByIdAsc(any(), any()))
                .thenThrow(new IllegalStateException("database unavailable"));
        assertThatThrownBy(() -> uploads.store(part, 1L, null, null, 0)).isInstanceOf(IllegalStateException.class);
        verify(storage).delete(anyString());
    }
}
