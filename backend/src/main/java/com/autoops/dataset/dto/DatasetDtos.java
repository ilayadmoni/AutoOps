package com.autoops.dataset.dto;

import com.autoops.dataset.entity.DatasetImport;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class DatasetDtos {
    private DatasetDtos() {
    }

    /** approveUpTo: commands at or below this risk are approved on import; others stay PENDING for per-command review. HIGH is never auto-approved. */
    public record Confirm(@Pattern(regexp = "^(NONE|LOW|MEDIUM)$") String approveUpTo) {
    }

    public record Reject(@Size(max = 1000) String reason) {
    }

    public record DatasetView(Long id, String filename, String status, Long sizeBytes, String checksum, int totalRecords,
                              int candidateRecords, int invalidRecords, int nonRhelRecords, int duplicateRecords, int processedRecords,
                              int addedRecords, int failedRecords, String errorMessage, String approveUpTo, String embeddingProvider,
                              String embeddingModel, Long uploadedBy, Long reviewedBy, Instant reviewedAt, Instant createdAt,
                              Instant startedAt, Instant finishedAt, Object analysis) {
        public static DatasetView from(DatasetImport d, Object analysis) {
            return new DatasetView(d.getId(), d.getFilename(), d.getStatus(), d.getSizeBytes(), d.getChecksum(), n(d.getTotalRecords()),
                    n(d.getCandidateRecords()), n(d.getInvalidRecords()), n(d.getNonRhelRecords()), n(d.getDuplicateRecords()),
                    n(d.getProcessedRecords()), n(d.getAddedRecords()), n(d.getFailedRecords()), d.getErrorMessage(), d.getApproveUpTo(),
                    d.getEmbeddingProvider(), d.getEmbeddingModel(), d.getUploadedBy(), d.getReviewedBy(), d.getReviewedAt(),
                    d.getCreatedAt(), d.getStartedAt(), d.getFinishedAt(), analysis);
        }

        private static int n(Integer i) {
            return i == null ? 0 : i;
        }
    }
}
