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
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class StoredFileService {
    private static final Logger log = LoggerFactory.getLogger(StoredFileService.class);
    private final StoredFileRepository repo;
    private final ObjectStorageService storage;
    private final AuditService audit;
    private final long maxBytes;
    private final Duration orphanRetention;
    @PersistenceContext
    private EntityManager em;

    public StoredFileService(StoredFileRepository repo, ObjectStorageService storage, AuditService audit,
                             @Value("${spring.servlet.multipart.max-file-size:100MB}") DataSize maxSize,
                             @Value("${autoops.files.orphan-retention-days:7}") long retentionDays) {
        this.repo = repo;
        this.storage = storage;
        this.audit = audit;
        this.maxBytes = maxSize.toBytes();
        this.orphanRetention = Duration.ofDays(Math.max(1, retentionDays));
    }

    public record FileView(Long id, String filename, long size, String checksum, String contentType, Instant createdAt,
                           List<String> referencedBy) {
    }

    /**
     * Streams the upload to object storage while computing SHA-256; metadata is saved only after the object exists,
     * and the object is removed again if saving metadata fails.
     */
    public FileView upload(MultipartFile file, Long userId) {
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("File is required");
        }
        if (file.getSize() > maxBytes) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "File exceeds the maximum allowed size");
        }
        String filename = sanitizeFilename(file.getOriginalFilename());
        String key = "files/" + userId + "/" + UUID.randomUUID();
        String checksum;
        try (InputStream raw = file.getInputStream(); DigestInputStream in = new DigestInputStream(raw, MessageDigest.getInstance("SHA-256"))) {
            storage.put(key, in, file.getSize(), safeContentType(file.getContentType()));
            checksum = HexFormat.of().formatHex(in.getMessageDigest().digest());
        } catch (ObjectStorageService.StorageException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", e.getMessage());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UPLOAD_FAILED", "Unable to read the uploaded file");
        }
        // The same bytes under the same name are already stored: reuse that file instead of keeping a second copy.
        var existing = repo.findFirstByOriginalFilenameAndChecksumAndDeletedAtIsNullOrderByIdAsc(filename, checksum);
        if (existing.isPresent()) {
            try {
                storage.delete(key);
            } catch (RuntimeException cleanup) {
                log.warn("Could not remove duplicate object {}", key);
            }
            return view(existing.get());
        }
        try {
            StoredFile stored = new StoredFile();
            stored.setOriginalFilename(filename);
            stored.setObjectKey(key);
            stored.setSize(file.getSize());
            stored.setChecksum(checksum);
            stored.setContentType(safeContentType(file.getContentType()));
            stored.setCreatedBy(userId);
            stored = repo.save(stored);
            audit.record(userId, "FILE_UPLOADED", "FILE", stored.getId(), Map.of("filename", filename, "size", file.getSize(), "sha256", checksum));
            return view(stored);
        } catch (RuntimeException e) {
            try {
                storage.delete(key);
            } catch (RuntimeException cleanup) {
                log.warn("Could not remove object {} after metadata failure", key);
            }
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public List<FileView> list(Long userId) {
        // Collapse copies of the same file (name + content): prefer one a workflow uses, else the newest.
        Map<String, FileView> unique = new java.util.LinkedHashMap<>();
        for (StoredFile f : repo.findByDeletedAtIsNullOrderByIdDesc()) {
            String key = f.getOriginalFilename() + "|" + f.getChecksum();
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
                activeReferences(f.getId()));
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

    private static String safeContentType(String type) {
        if (type == null || type.length() > 200 || !type.matches("^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+(;.*)?$")) {
            return "application/octet-stream";
        }
        return type;
    }
}
