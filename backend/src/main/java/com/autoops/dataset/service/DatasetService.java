package com.autoops.dataset.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.common.error.ApiException;
import com.autoops.dataset.dto.DatasetDtos;
import com.autoops.dataset.entity.DatasetImport;
import com.autoops.dataset.repository.DatasetImportRepository;
import com.autoops.files.service.ObjectStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;

@Service
public class DatasetService {
    private static final Logger log = LoggerFactory.getLogger(DatasetService.class);
    private final DatasetImportRepository repo;
    private final CommandDefinitionRepository commands;
    private final ObjectStorageService storage;
    private final AuditService audit;
    private final TransactionTemplate tx;
    private final DatasetState state;
    private final DatasetUpload upload;
    private final DatasetAnalysis analysis;
    private final DatasetRowImporter importer;
    private final ExecutorService worker;

    public DatasetService(DatasetImportRepository repo, CommandDefinitionRepository commands, ObjectStorageService storage, AuditService audit, TransactionTemplate tx, DatasetState state, DatasetUpload upload, DatasetAnalysis analysis, DatasetRowImporter importer, @Qualifier("datasetWorker") ExecutorService worker) {
        this.repo = repo;
        this.commands = commands;
        this.storage = storage;
        this.audit = audit;
        this.tx = tx;
        this.state = state;
        this.upload = upload;
        this.analysis = analysis;
        this.importer = importer;
        this.worker = worker;
    }

    public List<DatasetDtos.DatasetView> list() {
        return repo.findAllByOrderByIdDesc().stream().map(d -> DatasetDtos.DatasetView.from(d, null)).toList();
    }

    public DatasetDtos.DatasetView get(Long id) {
        DatasetImport d = state.load(id);
        return DatasetDtos.DatasetView.from(d, state.readAnalysis(d.getAnalysis()));
    }

    public DatasetDtos.DatasetView upload(Long adminId, MultipartFile file) {
        return upload.upload(adminId, file);
    }

    public DatasetDtos.DatasetView confirm(Long adminId, Long id) {
        tx.executeWithoutResult(s -> {
            DatasetImport d = state.load(id);
            if (!"READY_FOR_REVIEW".equals(d.getStatus())) {
                throw ApiException.conflict("DATASET_NOT_REVIEWABLE", "Only analyzed datasets awaiting review can be imported");
            }
            if (d.getCandidateRecords() == null || d.getCandidateRecords() == 0) {
                throw ApiException.conflict("DATASET_EMPTY", "The dataset has no importable rows");
            }
            d.setStatus("IMPORTING");
            d.setReviewedBy(adminId);
            d.setReviewedAt(Instant.now());
            d.setStartedAt(Instant.now());
            d.setProcessedRecords(0);
            d.setAddedRecords(0);
            d.setFailedRecords(0);
            repo.save(d);
        });
        audit.record(adminId, "DATASET_CONFIRMED", "DATASET", id, Map.of());
        worker.execute(() -> importer.importRows(id));
        return get(id);
    }

    public DatasetDtos.DatasetView reject(Long adminId, Long id, String reason) {
        tx.executeWithoutResult(s -> {
            DatasetImport d = state.load(id);
            if (!Set.of("READY_FOR_REVIEW", "FAILED", "UPLOADED").contains(d.getStatus())) {
                throw ApiException.conflict("DATASET_NOT_REVIEWABLE", "This dataset can no longer be rejected");
            }
            d.setStatus("REJECTED");
            d.setReviewedBy(adminId);
            d.setReviewedAt(Instant.now());
            d.setErrorMessage(reason == null || reason.isBlank() ? null : reason.strip());
            repo.save(d);
        });
        audit.record(adminId, "DATASET_REJECTED", "DATASET", id, Map.of("reason", String.valueOf(reason)));
        return get(id);
    }

    /**
     * Deletes an import, its stored file and the commands it added. Commands a workflow or past execution uses are
     * kept (the foreign key unlinks them). Not allowed while the import is being analyzed or imported.
     */
    public DatasetDtos.DeleteResult delete(Long adminId, Long id) {
        int[] counts = new int[2];
        String objectKey = tx.execute(s -> {
            DatasetImport d = state.load(id);
            if (Set.of("ANALYZING", "IMPORTING").contains(d.getStatus())) {
                throw ApiException.conflict("DATASET_BUSY", "Wait until this dataset finishes processing before deleting it");
            }
            List<Long> added = commands.findByDatasetImportId(id).stream().map(CommandDefinition::getId).toList();
            Set<Long> inUse = added.isEmpty() ? Set.of() : new HashSet<>(commands.findReferencedIds(added));
            List<Long> removable = added.stream().filter(c -> !inUse.contains(c)).toList();
            commands.deleteAllByIdInBatch(removable);
            counts[0] = removable.size();
            counts[1] = inUse.size();
            repo.delete(d);
            return d.getObjectKey();
        });
        try {
            storage.delete(objectKey);
        } catch (ObjectStorageService.StorageException e) {
            log.warn("Dataset {} file {} was not removed from storage: {}", id, objectKey, e.getMessage());
        }
        audit.record(adminId, "DATASET_DELETED", "DATASET", id, Map.of("deletedCommands", counts[0], "keptCommands", counts[1]));
        return new DatasetDtos.DeleteResult(counts[0], counts[1]);
    }

    void resumeAfterRestart() {
        for (DatasetImport d : repo.findByStatusIn(List.of("UPLOADED", "ANALYZING", "IMPORTING"))) {
            if ("IMPORTING".equals(d.getStatus())) {
                state.fail(d.getId(), "Import interrupted by a server restart after " + d.getProcessedRecords() + " rows");
            } else {
                Long id = d.getId();
                state.update(id, x -> x.setStatus("UPLOADED"));
                worker.execute(() -> analysis.analyze(id));
            }
        }
    }

}
