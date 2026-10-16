package com.autoops.files.service;

import com.autoops.common.error.ApiException;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.file.Files;
import java.util.List;
import java.util.zip.GZIPInputStream;
import static org.assertj.core.api.Assertions.*;

class FolderArchiveTest {
    @Test void preservesHierarchyUnicodeEmptyFilesAndExecutableModes() throws Exception {
        var request = new FolderManifest.Request("app", List.of("config/שלום.json", "bin/run.sh", "empty"), List.of("bin/run.sh"));
        var parts = List.of(file("{\"ok\":true}"), file("#!/bin/sh\necho ready\n"), file(""));
        java.nio.file.Path path;
        try (var archive = FolderArchive.build(request, List.copyOf(parts), 10000)) {
            path = archive.path();
            assertThat(archive.entries()).extracting(FolderManifest.Entry::path).containsExactly("bin/run.sh", "config/שלום.json", "empty");
            try (var tar = new TarArchiveInputStream(new GZIPInputStream(Files.newInputStream(path)))) {
                var run = tar.getNextEntry();
                assertThat(run.getName()).isEqualTo("bin/run.sh");
                assertThat(run.getMode()).isEqualTo(0755);
                assertThat(new String(tar.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)).contains("echo ready");
                var config = tar.getNextEntry();
                assertThat(config.getName()).isEqualTo("config/שלום.json");
                assertThat(config.getMode()).isEqualTo(0644);
                assertThat(tar.getNextEntry().getSize()).isZero();
                assertThat(tar.getNextEntry()).isNull();
            }
        }
        assertThat(path).doesNotExist();
    }
    @ParameterizedTest @ValueSource(strings = {"../secret", "/etc/passwd", "a/../../b", "a//b", "a/./b", "C:/x", "a\\b", "a/", "a\nfile"})
    void rejectsUnsafePaths(String path) {
        assertThatThrownBy(() -> FolderPaths.validate(new FolderManifest.Request("app", List.of(path), List.of()), 1)).isInstanceOf(ApiException.class);
    }
    @Test void rejectsConflictingPathsAndExecutableEntriesOutsideThePackage() {
        assertThatThrownBy(() -> FolderPaths.validate(new FolderManifest.Request("app", List.of("a", "a/b"), List.of()), 2)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> FolderPaths.validate(new FolderManifest.Request("app", List.of("a", "a"), List.of()), 2)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> FolderPaths.validate(new FolderManifest.Request("app", List.of("a"), List.of("missing")), 1)).isInstanceOf(ApiException.class);
    }
    @Test void rejectsEmptyFoldersAndExcessiveCountsAndBytes() {
        assertThatThrownBy(() -> FolderArchive.build(new FolderManifest.Request("app", List.of(), List.of()), List.of(), 10)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> FolderPaths.validate(new FolderManifest.Request("app", List.of("a"), List.of()), 1001)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> FolderArchive.build(new FolderManifest.Request("app", List.of("a"), List.of()), List.of(file("too big")), 2)).isInstanceOf(ApiException.class);
    }
    private MockMultipartFile file(String text) { return new MockMultipartFile("files", "ignored", "text/plain", text.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
}
