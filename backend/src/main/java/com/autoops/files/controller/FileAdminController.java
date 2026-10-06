package com.autoops.files.controller;

import com.autoops.audit.service.AuditService;
import com.autoops.common.security.CurrentUser;
import com.autoops.files.service.StoredFileService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/files")
public class FileAdminController {
    private final StoredFileService files;
    private final AuditService audit;
    private final CurrentUser current;

    public FileAdminController(StoredFileService files, AuditService audit, CurrentUser current) {
        this.files = files;
        this.audit = audit;
        this.current = current;
    }

    /** Runs the conservative orphan cleanup now (it also runs nightly). */
    @PostMapping("/cleanup")
    public Map<String, Integer> cleanup() {
        int purged = files.purgeOrphans();
        audit.record(current.id(), "FILES_ORPHAN_CLEANUP", "FILE", null, Map.of("purged", purged));
        return Map.of("purged", purged);
    }
}
