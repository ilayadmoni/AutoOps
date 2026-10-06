package com.autoops.files.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "stored_files")
public class StoredFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "original_filename", nullable = false)
    private String originalFilename;
    @Column(name = "object_key", nullable = false, unique = true)
    private String objectKey;
    @Column(nullable = false)
    private Long size;
    @Column(nullable = false)
    private String checksum;
    @Column(name = "content_type")
    private String contentType;
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "orphaned_at")
    private Instant orphanedAt;
    @Column(name = "deleted_at")
    private Instant deletedAt;

    public Long getId() { return id; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String v) { originalFilename = v; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String v) { objectKey = v; }
    public Long getSize() { return size; }
    public void setSize(Long v) { size = v; }
    public String getChecksum() { return checksum; }
    public void setChecksum(String v) { checksum = v; }
    public String getContentType() { return contentType; }
    public void setContentType(String v) { contentType = v; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long v) { createdBy = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getOrphanedAt() { return orphanedAt; }
    public void setOrphanedAt(Instant v) { orphanedAt = v; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant v) { deletedAt = v; }
}
