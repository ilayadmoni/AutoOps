package com.autoops.execution.engine;

import com.autoops.files.service.FolderArchive;
import com.autoops.files.service.FolderManifest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.*;

/** Executes the real deployment shell only inside disposable local fixtures. No SSH or user's VM. */
class FolderDeployCommandsTest {
    @TempDir Path root;
    @Test void deploysHierarchyAndRefusesExistingDestinationUnlessReplacementIsEnabled() throws Exception {
        Path dest = root.resolve("app space ' quote");
        try (var archive = archive()) {
            var first = run(archive.path(), dest, checksum(archive.path()), false, "first", "");
            assertThat(first.exit).withFailMessage(first.output).isZero();
            assertThat(Files.readString(dest.resolve("config/app.conf"))).isEqualTo("ready");
            Files.writeString(dest.resolve("old-only"), "old");
            var refused = run(archive.path(), dest, checksum(archive.path()), false, "refused", "");
            assertThat(refused.exit).isNotZero(); assertThat(refused.output).contains("Replace directory is disabled");
            assertThat(dest.resolve("old-only")).exists();
            assertThat(run(archive.path(), dest, checksum(archive.path()), true, "replace", "").exit).isZero();
            assertThat(dest.resolve("old-only")).doesNotExist();
            assertThat(Files.readString(dest.resolve("config/app.conf"))).isEqualTo("ready");
        }
        assertNoTemporaryPaths();
    }
    @Test void checksumOrExtractionFailureLeavesExistingContentsUntouched() throws Exception {
        Path dest = Files.createDirectory(root.resolve("app")); Files.writeString(dest.resolve("old"), "original");
        Path corrupt = Files.writeString(root.resolve("invalid.tar.gz"), "not a tar archive");
        var mismatch = run(corrupt, dest, "bad-checksum", true, "bad-sum", "");
        assertThat(mismatch.exit).isNotZero(); assertThat(mismatch.output).contains("checksum mismatch");
        assertThat(run(corrupt, dest, checksum(corrupt), true, "bad-tar", "").exit).isNotZero();
        assertThat(Files.readString(dest.resolve("old"))).isEqualTo("original");
        assertNoTemporaryPaths();
    }
    @Test void restoresBackupWhenFinalRenameFails() throws Exception {
        Path dest = Files.createDirectory(root.resolve("app")); Files.writeString(dest.resolve("old"), "original");
        // Inject a final-rename failure; the backup move and rollback continue to use the real mv.
        String fault = "mv() { case \"$*\" in *autoops-stage*) return 1;; *) command mv \"$@\";; esac; }\n";
        try (var archive = archive()) {
            assertThat(run(archive.path(), dest, checksum(archive.path()), true, "rollback", fault).exit).isNotZero();
        }
        assertThat(Files.readString(dest.resolve("old"))).isEqualTo("original");
        assertNoTemporaryPaths();
    }
    @Test void refusesRegularFileDestinationAndConcurrentDeploymentLock() throws Exception {
        Path dest = Files.writeString(root.resolve("app"), "keep");
        try (var archive = archive()) {
            assertThat(run(archive.path(), dest, checksum(archive.path()), true, "file", "").output).contains("not a directory");
            Files.delete(dest); Files.createDirectory(root.resolve("app.autoops-lock"));
            assertThat(run(archive.path(), dest, checksum(archive.path()), true, "locked", "").output).contains("locked by another");
            assertThat(root.resolve("app.autoops-lock")).exists();
        }
    }
    private FolderArchive archive() throws Exception {
        return FolderArchive.build(new FolderManifest.Request("app", List.of("config/app.conf"), List.of()),
                List.of(new MockMultipartFile("files", "ignored", "text/plain", "ready".getBytes())), 1000);
    }
    private record Result(int exit, String output) {}
    private Result run(Path archive, Path dest, String checksum, boolean replace, String nonce, String prefix) throws Exception {
        Path script = root.resolve("deploy.sh");
        Files.writeString(script, prefix + FolderDeployCommands.deploy(posix(archive), posix(dest), checksum, replace, nonce));
        var process = new ProcessBuilder("sh", posix(script)).redirectErrorStream(true).start();
        assertThat(process.waitFor(20, TimeUnit.SECONDS)).as("deployment should finish promptly").isTrue();
        return new Result(process.exitValue(), new String(process.getInputStream().readAllBytes()));
    }
    private String posix(Path path) {
        String value = path.toAbsolutePath().toString().replace('\\', '/');
        return value.matches("^[A-Za-z]:/.*") ? "/" + Character.toLowerCase(value.charAt(0)) + value.substring(2) : value;
    }
    private String checksum(Path path) throws Exception { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path))); }
    private void assertNoTemporaryPaths() throws Exception {
        try (var paths = Files.list(root)) { assertThat(paths.map(p -> p.getFileName().toString()).filter(n -> n.contains("autoops"))).isEmpty(); }
    }
}
