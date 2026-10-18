package com.autoops.files.service;

import com.autoops.common.error.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;

@Service
public class FolderPackageService {
    private final StoredFileUpload uploads;
    private final StoredFileService files;
    private final ObjectMapper json;
    public FolderPackageService(StoredFileUpload uploads, StoredFileService files, ObjectMapper json) {
        this.uploads = uploads; this.files = files; this.json = json;
    }
    public long maxBytes() { return uploads.maxBytes(); }
    public StoredFileService.FileView upload(FolderManifest.Request request, List<MultipartFile> parts, Long userId) {
        try (var archive = FolderArchive.build(request, parts, maxBytes())) {
            var stored = uploads.store(new PathMultipartFile(archive.path(), request.name() + ".tar.gz"), userId,
                    request.name(), json.writeValueAsString(archive.entries()), archive.entries().size());
            return files.get(userId, stored.getId());
        } catch (IOException e) { throw ApiException.validation("Unable to package the selected folder"); }
    }
    public List<FolderManifest.Entry> manifest(Long userId, Long id) {
        var stored = files.requireUsable(userId, id);
        if (stored.getFolderName() == null) throw ApiException.validation("This file is not a folder package");
        return FolderManifest.read(json, stored.getFolderManifest());
    }
}
