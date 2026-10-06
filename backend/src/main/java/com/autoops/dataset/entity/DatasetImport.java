package com.autoops.dataset.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/** UPLOADED -> ANALYZING -> READY_FOR_REVIEW -> IMPORTING -> COMPLETED; any stage -> FAILED; Admin may REJECT. */
@Entity
@Table(name = "dataset_imports")
public class DatasetImport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String filename;
    @Column(name = "object_key")
    private String objectKey;
    @Column(name = "size_bytes")
    private Long sizeBytes;
    private String checksum;
    @Column(nullable = false)
    private String status = "UPLOADED";
    @Column(name = "total_records")
    private Integer totalRecords = 0;
    @Column(name = "candidate_records")
    private Integer candidateRecords = 0;
    @Column(name = "invalid_records")
    private Integer invalidRecords = 0;
    @Column(name = "non_rhel_records")
    private Integer nonRhelRecords = 0;
    @Column(name = "duplicate_records")
    private Integer duplicateRecords = 0;
    @Column(name = "processed_records")
    private Integer processedRecords = 0;
    @Column(name = "added_records")
    private Integer addedRecords = 0;
    @Column(name = "rejected_records")
    private Integer rejectedRecords = 0;
    @Column(name = "failed_records")
    private Integer failedRecords = 0;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String analysis;
    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;
    @Column(name = "approve_up_to")
    private String approveUpTo;
    @Column(name = "embedding_provider")
    private String embeddingProvider;
    @Column(name = "embedding_model")
    private String embeddingModel;
    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;
    @Column(name = "reviewed_by")
    private Long reviewedBy;
    @Column(name = "reviewed_at")
    private Instant reviewedAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "started_at")
    private Instant startedAt;
    @Column(name = "finished_at")
    private Instant finishedAt;

    public Long getId() { return id; }
    public String getFilename() { return filename; }
    public void setFilename(String v) { filename = v; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String v) { objectKey = v; }
    public Long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Long v) { sizeBytes = v; }
    public String getChecksum() { return checksum; }
    public void setChecksum(String v) { checksum = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public Integer getTotalRecords() { return totalRecords; }
    public void setTotalRecords(Integer v) { totalRecords = v; }
    public Integer getCandidateRecords() { return candidateRecords; }
    public void setCandidateRecords(Integer v) { candidateRecords = v; }
    public Integer getInvalidRecords() { return invalidRecords; }
    public void setInvalidRecords(Integer v) { invalidRecords = v; }
    public Integer getNonRhelRecords() { return nonRhelRecords; }
    public void setNonRhelRecords(Integer v) { nonRhelRecords = v; }
    public Integer getDuplicateRecords() { return duplicateRecords; }
    public void setDuplicateRecords(Integer v) { duplicateRecords = v; }
    public Integer getProcessedRecords() { return processedRecords; }
    public void setProcessedRecords(Integer v) { processedRecords = v; }
    public Integer getAddedRecords() { return addedRecords; }
    public void setAddedRecords(Integer v) { addedRecords = v; }
    public Integer getRejectedRecords() { return rejectedRecords; }
    public void setRejectedRecords(Integer v) { rejectedRecords = v; }
    public Integer getFailedRecords() { return failedRecords; }
    public void setFailedRecords(Integer v) { failedRecords = v; }
    public String getAnalysis() { return analysis; }
    public void setAnalysis(String v) { analysis = v; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String v) { errorMessage = v; }
    public String getApproveUpTo() { return approveUpTo; }
    public void setApproveUpTo(String v) { approveUpTo = v; }
    public String getEmbeddingProvider() { return embeddingProvider; }
    public void setEmbeddingProvider(String v) { embeddingProvider = v; }
    public String getEmbeddingModel() { return embeddingModel; }
    public void setEmbeddingModel(String v) { embeddingModel = v; }
    public Long getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(Long v) { uploadedBy = v; }
    public Long getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(Long v) { reviewedBy = v; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant v) { reviewedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant v) { startedAt = v; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant v) { finishedAt = v; }
}
