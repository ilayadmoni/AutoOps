package com.autoops.files.service;

import com.autoops.common.error.ApiException;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Accepts relative regular-file paths only. The server generates the archive; no client archive is extracted. */
public final class FolderPaths {
    public static final int MAX_FILES = 1000;
    private FolderPaths() {}

    public static void validate(FolderManifest.Request request, int fileCount) {
        if (request == null || request.name() == null || request.name().isBlank() || request.name().length() > 150
                || request.name().contains("/") || request.name().contains("\\") || request.name().equals(".")
                || request.name().equals("..") || request.name().chars().anyMatch(c -> c < 32 || c == 127)) {
            throw ApiException.validation("Choose a folder with a valid name (up to 150 characters)");
        }
        if (fileCount < 1 || fileCount > MAX_FILES || request.paths() == null || request.paths().size() != fileCount) {
            throw ApiException.validation("A folder must contain 1-" + MAX_FILES + " files with matching paths");
        }
        Set<String> paths = new HashSet<>();
        for (String path : request.paths()) {
            if (path == null || path.isBlank() || path.startsWith("/") || path.contains("\\") || path.matches("^[A-Za-z]:.*")
                    || path.getBytes(StandardCharsets.UTF_8).length > 1024 || path.chars().anyMatch(c -> c < 32 || c == 127)) {
                throw ApiException.validation("Invalid folder entry path");
            }
            for (String part : path.split("/", -1)) {
                if (part.isEmpty() || part.equals(".") || part.equals("..")) throw ApiException.validation("Folder paths must stay inside the package");
            }
            if (!paths.add(path)) throw ApiException.validation("Duplicate folder entry: " + path);
        }
        for (String path : paths) {
            int slash = path.indexOf('/');
            while (slash >= 0) {
                if (paths.contains(path.substring(0, slash))) throw ApiException.validation("A file conflicts with a directory: " + path);
                slash = path.indexOf('/', slash + 1);
            }
        }
        List<String> executable = request.executablePaths() == null ? List.of() : request.executablePaths();
        if (executable.size() > fileCount || !paths.containsAll(executable)) throw ApiException.validation("Executable paths must refer to package files");
    }
}
