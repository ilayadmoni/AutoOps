package com.autoops.files.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.files.service.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FolderPackageController {
    private final FolderPackageService folders;
    private final CurrentUser current;
    public FolderPackageController(FolderPackageService folders, CurrentUser current) {
        this.folders = folders; this.current = current;
    }
    @GetMapping("/folders/limits")
    public Map<String, Long> limits() { return Map.of("maxFiles", (long) FolderPaths.MAX_FILES, "maxBytes", folders.maxBytes()); }
    @PostMapping(value = "/folders", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public StoredFileService.FileView upload(@RequestPart("manifest") FolderManifest.Request manifest,
                                             @RequestPart("files") List<MultipartFile> files) {
        return folders.upload(manifest, files, current.id());
    }
    @GetMapping("/{id}/manifest")
    public List<FolderManifest.Entry> manifest(@PathVariable Long id) { return folders.manifest(current.id(), id); }
    @DeleteMapping("/{id}/folders")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubfolder(@PathVariable Long id, @RequestParam String path) {
        folders.deleteSubfolder(current.id(), id, path);
    }
}
