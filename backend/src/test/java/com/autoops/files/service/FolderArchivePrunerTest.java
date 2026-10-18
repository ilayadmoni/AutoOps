package com.autoops.files.service;

import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.util.List;
import java.util.zip.GZIPInputStream;

import static org.assertj.core.api.Assertions.*;

class FolderArchivePrunerTest {
    @Test
    void removesOneDirectoryAndKeepsOtherFilesAndExecutableModes() throws Exception {
        var request = new FolderManifest.Request("app", List.of("logs/old.txt", "logs/nested/old.txt", "bin/run.sh"),
                List.of("bin/run.sh"));
        var files = List.of(file("old"), file("nested"), file("#!/bin/sh"));
        try (var original = FolderArchive.build(request, List.copyOf(files), 10000)) {
            var retained = original.entries().stream().filter(entry -> !entry.path().startsWith("logs/")).toList();
            try (var edited = FolderArchivePruner.prune(Files.newInputStream(original.path()), retained);
                 var tar = new TarArchiveInputStream(new GZIPInputStream(Files.newInputStream(edited.path())))) {
                assertThat(edited.entries()).extracting(FolderManifest.Entry::path).containsExactly("bin/run.sh");
                var entry = tar.getNextEntry();
                assertThat(entry.getName()).isEqualTo("bin/run.sh");
                assertThat(entry.getMode()).isEqualTo(0755);
                assertThat(new String(tar.readAllBytes())).isEqualTo("#!/bin/sh");
                assertThat(tar.getNextEntry()).isNull();
            }
        }
    }

    private MockMultipartFile file(String text) {
        return new MockMultipartFile("files", "ignored", "text/plain", text.getBytes());
    }
}
