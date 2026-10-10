package com.autoops.dataset.dto;

import com.autoops.dataset.entity.DatasetImport;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class DatasetDtos {
    private DatasetDtos() {
    }

    public record Reject(@Size(max = 1000) String reason) {
    }

    /** Outcome of deleting an import: commands removed, and commands kept because a workflow or execution uses them. */
    public record DeleteResult(int deletedCommands, int keptCommands) {
    }

    public record DatasetView(Long id, String filename, String status, Long sizeBytes, String checksum, int totalRecords,
                              int candidateRecords, int invalidRecords, int nonLinuxRecords, int duplicateRecords, int processedRecords,
                              int addedRecords, int failedRecords, String errorMessage, String embeddingProvider,
                              String embeddingModel, Long uploadedBy, Long reviewedBy, Instant reviewedAt, Instant createdAt,
                              Instant startedAt, Instant finishedAt, Object analysis) {
        public static DatasetView from(DatasetImport d, Object analysis) {
            return new DatasetView(d.getId(), d.getFilename(), d.getStatus(), d.getSizeBytes(), d.getChecksum(), n(d.getTotalRecords()),
                    n(d.getCandidateRecords()), n(d.getInvalidRecords()), n(d.getNonRhelRecords()), n(d.getDuplicateRecords()),
                    n(d.getProcessedRecords()), n(d.getAddedRecords()), n(d.getFailedRecords()), d.getErrorMessage(),
                    d.getEmbeddingProvider(), d.getEmbeddingModel(), d.getUploadedBy(), d.getReviewedBy(), d.getReviewedAt(),
                    d.getCreatedAt(), d.getStartedAt(), d.getFinishedAt(), analysis);
        }

        private static int n(Integer i) {
            return i == null ? 0 : i;
        }
    }
}
