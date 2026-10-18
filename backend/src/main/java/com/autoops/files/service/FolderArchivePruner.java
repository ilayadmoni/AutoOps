package com.autoops.files.service;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/** Rewrites a generated folder archive with only the manifest entries that should remain. */
final class FolderArchivePruner {
    private FolderArchivePruner() {}

    static FolderArchive prune(InputStream source, List<FolderManifest.Entry> retained) throws IOException {
        Path path = Files.createTempFile("autoops-folder-edit-", ".tar.gz");
        var expected = new HashMap<String, FolderManifest.Entry>();
        retained.forEach(entry -> expected.put(entry.path(), entry));
        Set<String> seen = new HashSet<>();
        try (var in = new TarArchiveInputStream(new GZIPInputStream(source));
             var out = new TarArchiveOutputStream(new GZIPOutputStream(Files.newOutputStream(path)), "UTF-8")) {
            out.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
            out.setAddPaxHeadersForNonAsciiNames(true);
            TarArchiveEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                FolderManifest.Entry item = expected.get(entry.getName());
                if (item == null) continue;
                if (!entry.isFile() || !seen.add(item.path()) || entry.getSize() != item.size())
                    throw new IOException("Folder archive does not match its manifest");
                var copy = new TarArchiveEntry(item.path());
                copy.setSize(item.size()); copy.setMode(item.executable() ? 0755 : 0644); copy.setModTime(0L);
                out.putArchiveEntry(copy);
                MessageDigest digest = sha256();
                byte[] buffer = new byte[8192];
                long left = item.size();
                while (left > 0) {
                    int count = in.read(buffer, 0, (int) Math.min(buffer.length, left));
                    if (count < 0) throw new IOException("Folder archive ended early");
                    digest.update(buffer, 0, count); out.write(buffer, 0, count); left -= count;
                }
                if (!HexFormat.of().formatHex(digest.digest()).equals(item.checksum()))
                    throw new IOException("Folder archive checksum mismatch");
                out.closeArchiveEntry();
            }
            if (seen.size() != expected.size()) throw new IOException("Folder archive is missing files");
        } catch (IOException | RuntimeException ex) {
            Files.deleteIfExists(path);
            throw ex;
        }
        return new FolderArchive(path, List.copyOf(retained));
    }

    private static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (Exception ex) { throw new IllegalStateException(ex); }
    }
}
