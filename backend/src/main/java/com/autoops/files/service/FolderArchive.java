package com.autoops.files.service;

import com.autoops.common.error.ApiException;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.zip.GZIPOutputStream;

public record FolderArchive(Path path, List<FolderManifest.Entry> entries) implements AutoCloseable {
    public void close() throws IOException { Files.deleteIfExists(path); }

    public static FolderArchive build(FolderManifest.Request request, List<MultipartFile> files, long maxBytes) throws IOException {
        FolderPaths.validate(request, files.size());
        long total = 0;
        for (MultipartFile file : files) {
            if (file.getSize() < 0 || file.getSize() > maxBytes - total) throw ApiException.validation("Folder exceeds the upload size limit");
            total += file.getSize();
        }
        Path archive = Files.createTempFile("autoops-folder-", ".tar.gz");
        List<FolderManifest.Entry> entries = new ArrayList<>();
        try (var gzip = new GZIPOutputStream(Files.newOutputStream(archive)); var tar = new TarArchiveOutputStream(gzip, "UTF-8")) {
            tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
            tar.setAddPaxHeadersForNonAsciiNames(true);
            List<Integer> order = new ArrayList<>();
            for (int i = 0; i < files.size(); i++) order.add(i);
            order.sort(Comparator.comparing(request.paths()::get));
            for (int index : order) {
                String name = request.paths().get(index);
                MultipartFile file = files.get(index);
                boolean executable = request.executablePaths() != null && request.executablePaths().contains(name);
                TarArchiveEntry entry = new TarArchiveEntry(name);
                entry.setSize(file.getSize()); entry.setModTime(0L); entry.setMode(executable ? 0755 : 0644);
                tar.putArchiveEntry(entry);
                MessageDigest digest = digest();
                long copied = 0;
                try (var in = file.getInputStream()) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = in.read(buffer)) != -1) {
                        if (count > file.getSize() - copied) throw ApiException.validation("Folder entry size changed during upload");
                        digest.update(buffer, 0, count); tar.write(buffer, 0, count); copied += count;
                    }
                }
                if (copied != file.getSize()) throw ApiException.validation("Incomplete folder entry: " + name);
                tar.closeArchiveEntry();
                entries.add(new FolderManifest.Entry(name, copied, HexFormat.of().formatHex(digest.digest()), executable));
            }
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(archive); throw e;
        }
        return new FolderArchive(archive, List.copyOf(entries));
    }

    private static MessageDigest digest() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
