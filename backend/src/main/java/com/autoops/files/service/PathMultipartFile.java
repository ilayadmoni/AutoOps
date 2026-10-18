package com.autoops.files.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/** Disk-backed generated archive, so packaging does not copy the entire upload into heap memory. */
final class PathMultipartFile implements MultipartFile {
    private final Path path;
    private final String filename;
    PathMultipartFile(Path path, String filename) { this.path = path; this.filename = filename; }
    public String getName() { return "file"; }
    public String getOriginalFilename() { return filename; }
    public String getContentType() { return "application/gzip"; }
    public boolean isEmpty() { return getSize() == 0; }
    public long getSize() {
        try { return Files.size(path); } catch (IOException e) { throw new IllegalStateException("Cannot read generated package", e); }
    }
    public byte[] getBytes() throws IOException { return Files.readAllBytes(path); }
    public InputStream getInputStream() throws IOException { return Files.newInputStream(path); }
    public void transferTo(File dest) throws IOException { Files.copy(path, dest.toPath(), StandardCopyOption.REPLACE_EXISTING); }
}
