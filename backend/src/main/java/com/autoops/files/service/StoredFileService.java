package com.autoops.files.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.repository.StoredFileRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class StoredFileService {
    private static final Logger log = LoggerFactory.getLogger(StoredFileService.class);
    private final StoredFileRepository repo;
    private final ObjectStorageService storage;
    private final AuditService audit;
    private final StoredFileUpload uploads;
    private final Duration orphanRetention;
    @PersistenceContext
    private EntityManager em;

    public StoredFileService(StoredFileRepository repo, ObjectStorageService storage, AuditService audit,
                             StoredFileUpload uploads,
                             @Value("${autoops.files.orphan-retention-days:7}") long retentionDays) {
        this.repo = repo;
        this.storage = storage;
        this.audit = audit;
        this.uploads = uploads;
        this.orphanRetention = Duration.ofDays(Math.max(1, retentionDays));
    }

    public record FileView(Long id, String filename, long size, String checksum, String contentType, Instant createdAt,
                           List<String> referencedBy, String folderName, int fileCount) {
    }

    public FileView upload(MultipartFile file, Long userId) {
        return view(uploads.store(file, userId, null, null, 0));
    }

    @Transactional(readOnly = true)
    public List<FileView> list(Long userId) {
        // Collapse copies of the same file (name + content): prefer one a workflow uses, else the newest.
        Map<String, FileView> unique = new java.util.LinkedHashMap<>();
        for (StoredFile f : repo.findByDeletedAtIsNullOrderByIdDesc()) {
            String key = f.getFolderName() == null ? f.getOriginalFilename() + "|" + f.getChecksum() : "folder:" + f.getId();
            FileView current = unique.get(key);
            if (current == null) {
                unique.put(key, view(f));
            } else if (current.referencedBy().isEmpty()) {
                FileView candidate = view(f);
                if (!candidate.referencedBy().isEmpty()) {
                    unique.put(key, candidate);
                }
            }
        }
        return List.copyOf(unique.values());
    }

    @Transactional(readOnly = true)
    public FileView get(Long userId, Long id) {
        return view(requireUsable(userId, id));
    }

    /** Owned and not deleted, or 404. */
    @Transactional(readOnly = true)
    public StoredFile requireUsable(Long userId, Long id) {
        if (id == null) {
            throw ApiException.validation("A stored file must be selected");
        }
        return repo.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> ApiException.notFound("File"));
    }

    public InputStream open(StoredFile f) {
        return storage.get(f.getObjectKey());
    }

    /** Refuses while an active workflow uses the file; otherwise soft-deletes and marks it orphaned for cleanup. */
    @Transactional
    public void delete(Long userId, Long id) {
        StoredFile f = requireUsable(userId, id);
        List<String> refs = activeReferences(id);
        if (!refs.isEmpty()) {
            throw ApiException.conflict("FILE_IN_USE", "File is used by workflow(s): " + String.join(", ", refs));
        }
        f.setDeletedAt(Instant.now());
        f.setOrphanedAt(Instant.now());
        repo.save(f);
        audit.record(userId, "FILE_DELETED", "FILE", id, Map.of("filename", f.getOriginalFilename()));
    }

    /** Conservative cleanup: only orphans older than the retention window with no workflow-step references at all. */
    @Scheduled(cron = "${autoops.files.cleanup-cron:0 23 2 * * *}")
    public int purgeOrphans() {
        int purged = 0;
        for (StoredFile f : repo.findPurgeableOrphans(Instant.now().minus(orphanRetention))) {
            try {
                storage.delete(f.getObjectKey());
                repo.delete(f);
                purged++;
            } catch (RuntimeException e) {
                log.warn("Orphan cleanup skipped file {}: {}", f.getId(), e.getMessage());
            }
        }
        if (purged > 0) {
            log.info("Purged {} orphaned stored files", purged);
        }
        return purged;
    }

    @SuppressWarnings("unchecked")
    private List<String> activeReferences(Long fileId) {
        return (List<String>) em.createNativeQuery("""
                SELECT DISTINCT w.name FROM file_transfer_steps f JOIN workflow_steps s ON s.id = f.id
                JOIN workflows w ON w.id = s.workflow_id WHERE f.stored_file_id = :id AND w.deleted_at IS NULL""")
                .setParameter("id", fileId).getResultList();
    }

    private FileView view(StoredFile f) {
        return new FileView(f.getId(), f.getOriginalFilename(), f.getSize(), f.getChecksum(), f.getContentType(), f.getCreatedAt(),
                activeReferences(f.getId()), f.getFolderName(), f.getFolderFileCount());
    }

    static String sanitizeFilename(String name) {
        String n = name == null ? "" : name;
        n = n.replace('\\', '/');
        n = n.substring(n.lastIndexOf('/') + 1);
        n = n.replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (n.isEmpty() || n.equals(".") || n.equals("..")) {
            n = "upload";
        }
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }

}
