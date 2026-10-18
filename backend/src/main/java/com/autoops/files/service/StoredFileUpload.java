package com.autoops.files.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.repository.StoredFileRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
public class StoredFileUpload {
    private final StoredFileRepository repo;
    private final ObjectStorageService storage;
    private final AuditService audit;
    private final long maxBytes;
    public StoredFileUpload(StoredFileRepository repo, ObjectStorageService storage, AuditService audit,
                           @Value("${spring.servlet.multipart.max-file-size:100MB}") DataSize limit) {
        this.repo = repo; this.storage = storage; this.audit = audit; this.maxBytes = limit.toBytes();
    }
    public long maxBytes() { return maxBytes; }
    public StoredFile store(MultipartFile file, Long userId, String folderName, String manifest, int count) {
        if (file == null || file.isEmpty()) throw ApiException.validation("File is required");
        if (file.getSize() > maxBytes) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Upload exceeds the size limit");
        String filename = StoredFileService.sanitizeFilename(file.getOriginalFilename());
        String key = "files/" + userId + "/" + UUID.randomUUID();
        String type = safeContentType(file.getContentType());
        String checksum;
        try (var in = new DigestInputStream(file.getInputStream(), MessageDigest.getInstance("SHA-256"))) {
            storage.put(key, in, file.getSize(), type);
            checksum = HexFormat.of().formatHex(in.getMessageDigest().digest());
        } catch (Exception e) {
            cleanup(key);
            if (e instanceof ObjectStorageService.StorageException) {
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", e.getMessage());
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "UPLOAD_FAILED", "Unable to read the uploaded file");
        }
        try {
            if (folderName == null) {
                var existing = repo.findFirstByOriginalFilenameAndChecksumAndFolderNameIsNullAndDeletedAtIsNullOrderByIdAsc(filename, checksum);
                if (existing.isPresent()) { cleanup(key); return existing.get(); }
            }
            StoredFile stored = new StoredFile();
            stored.setOriginalFilename(filename); stored.setObjectKey(key); stored.setSize(file.getSize());
            stored.setChecksum(checksum); stored.setContentType(type); stored.setCreatedBy(userId);
            stored.setFolderName(folderName); stored.setFolderManifest(manifest); stored.setFolderFileCount(count);
            stored = repo.saveAndFlush(stored);
            audit.record(userId, "FILE_UPLOADED", "FILE", stored.getId(), Map.of("filename", filename, "size", file.getSize(), "sha256", checksum));
            return stored;
        } catch (RuntimeException e) { cleanup(key); throw e; }
    }
    private void cleanup(String key) {
        try { storage.delete(key); }
        catch (RuntimeException e) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Upload cleanup skipped {}", key); }
    }
    private static String safeContentType(String type) {
        return type != null && type.length() <= 200 && type.matches("^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+(;.*)?$")
                ? type : "application/octet-stream";
    }
}
