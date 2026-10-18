package com.autoops.files.service;

import com.autoops.common.error.ApiException;
import com.autoops.audit.service.AuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
public class FolderPackageService {
    private final StoredFileUpload uploads;
    private final StoredFileService files;
    private final ObjectMapper json;
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    public FolderPackageService(StoredFileUpload uploads, StoredFileService files, ObjectMapper json,
                                JdbcTemplate jdbc, AuditService audit) {
        this.uploads = uploads; this.files = files; this.json = json; this.jdbc = jdbc; this.audit = audit;
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

    /** Creates a new package version without a subdirectory; active workflow references keep the old version intact. */
    public void deleteSubfolder(Long userId, Long id, String path) {
        var view = files.get(userId, id);
        if (view.folderName() == null) throw ApiException.validation("This file is not a folder package");
        if (!view.referencedBy().isEmpty()) throw ApiException.conflict("FILE_IN_USE", "Folder is used by a workflow");
        var stored = files.requireUsable(userId, id);
        List<FolderManifest.Entry> entries = FolderManifest.read(json, stored.getFolderManifest());
        String prefix = path == null ? "" : path + "/";
        if (prefix.length() < 2 || entries.stream().noneMatch(entry -> entry.path().startsWith(prefix)))
            throw ApiException.notFound("Folder");
        List<FolderManifest.Entry> retained = entries.stream().filter(entry -> !entry.path().startsWith(prefix)).toList();
        if (retained.isEmpty()) {
            files.delete(userId, id);
        } else {
            try (var archive = FolderArchivePruner.prune(files.open(stored), retained)) {
                var replacement = uploads.store(new PathMultipartFile(archive.path(), stored.getOriginalFilename()), userId,
                        stored.getFolderName(), json.writeValueAsString(retained), retained.size());
                try { files.delete(userId, id); }
                catch (RuntimeException ex) { files.delete(userId, replacement.getId()); throw ex; }
                jdbc.update("UPDATE user_favorites SET item_id = ? WHERE collection = 'files' AND item_id = ?", replacement.getId(), id);
            } catch (IOException ex) { throw ApiException.validation("Unable to update folder package"); }
        }
        audit.record(userId, "FOLDER_SUBDIRECTORY_DELETED", "FILE", id,
                Map.of("path", path, "removedFiles", entries.size() - retained.size()));
    }
}
