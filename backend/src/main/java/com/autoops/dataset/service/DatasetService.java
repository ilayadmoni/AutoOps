package com.autoops.dataset.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.common.error.ApiException;
import com.autoops.dataset.dto.DatasetDtos;
import com.autoops.dataset.entity.DatasetImport;
import com.autoops.dataset.repository.DatasetImportRepository;
import com.autoops.embedding.EmbeddingProvider;
import com.autoops.embedding.EmbeddingService;
import com.autoops.files.service.ObjectStorageService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;

/**
 * Admin-reviewed dataset import. Uploading stores the original in object storage and analyzes it in the background;
 * nothing enters the Command Bank until an Admin confirms the reviewed preview.
 */
@Service
public class DatasetService {
    private static final Logger log = LoggerFactory.getLogger(DatasetService.class);
    private static final int PREVIEW = 25;
    private static final int ISSUES = 200;

    private final DatasetImportRepository repo;
    private final DatasetEvaluator evaluator;
    private final ObjectStorageService storage;
    private final CommandDefinitionRepository commands;
    private final CommandTemplateService templates;
    private final EmbeddingService embeddings;
    private final EmbeddingProvider embeddingProvider;
    private final AuditService audit;
    private final ObjectMapper json;
    private final TransactionTemplate tx;
    private final ExecutorService worker;
    private final long maxBytes;

    public DatasetService(DatasetImportRepository repo, DatasetEvaluator evaluator, ObjectStorageService storage,
                          CommandDefinitionRepository commands, CommandTemplateService templates, EmbeddingService embeddings,
                          EmbeddingProvider embeddingProvider, AuditService audit, ObjectMapper json, TransactionTemplate tx,
                          @Qualifier("datasetWorker") ExecutorService worker,
                          @Value("${autoops.datasets.max-size:20MB}") DataSize maxSize) {
        this.repo = repo;
        this.evaluator = evaluator;
        this.storage = storage;
        this.commands = commands;
        this.templates = templates;
        this.embeddings = embeddings;
        this.embeddingProvider = embeddingProvider;
        this.audit = audit;
        this.json = json;
        this.tx = tx;
        this.worker = worker;
        this.maxBytes = maxSize.toBytes();
    }

    public List<DatasetDtos.DatasetView> list() {
        return repo.findAllByOrderByIdDesc().stream().map(d -> DatasetDtos.DatasetView.from(d, null)).toList();
    }

    public DatasetDtos.DatasetView get(Long id) {
        DatasetImport d = load(id);
        return DatasetDtos.DatasetView.from(d, readAnalysis(d.getAnalysis()));
    }

    public DatasetDtos.DatasetView upload(Long adminId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("A CSV or JSON file is required");
        }
        if (file.getSize() > maxBytes) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Dataset exceeds the maximum allowed size");
        }
        String name = Objects.toString(file.getOriginalFilename(), "dataset.csv").replaceAll("[\\p{Cntrl}/\\\\\"]", "_");
        DatasetFormat format = DatasetFormat.fromFilename(name)
                .orElseThrow(() -> ApiException.validation("Only .csv and .json datasets are supported"));
        String key = "datasets/" + UUID.randomUUID() + format.extension();
        String checksum;
        try (InputStream raw = file.getInputStream(); DigestInputStream in = new DigestInputStream(raw, MessageDigest.getInstance("SHA-256"))) {
            storage.put(key, in, file.getSize(), format.contentType());
            checksum = HexFormat.of().formatHex(in.getMessageDigest().digest());
        } catch (ObjectStorageService.StorageException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", e.getMessage());
        } catch (Exception e) {
            throw ApiException.validation("Unable to read the uploaded dataset");
        }
        DatasetImport d = new DatasetImport();
        d.setFilename(name.length() > 200 ? name.substring(name.length() - 200) : name);
        d.setObjectKey(key);
        d.setSizeBytes(file.getSize());
        d.setChecksum(checksum);
        d.setUploadedBy(adminId);
        d.setStatus("UPLOADED");
        d = repo.save(d);
        audit.record(adminId, "DATASET_UPLOADED", "DATASET", d.getId(), Map.of("filename", d.getFilename(), "size", file.getSize(), "sha256", checksum));
        Long id = d.getId();
        worker.execute(() -> analyze(id));
        return DatasetDtos.DatasetView.from(d, null);
    }

    /** Imports created before JSON support are all CSV, so an unknown extension falls back to CSV. */
    private static DatasetFormat formatOf(DatasetImport d) {
        return DatasetFormat.fromFilename(d.getFilename()).orElse(DatasetFormat.CSV);
    }

    /** Background analysis: counts, issues and a preview. No command is created here. */
    void analyze(Long id) {
        if (!transition(id, Set.of("UPLOADED", "ANALYZING"), "ANALYZING")) {
            return;
        }
        DatasetImport d = load(id);
        List<DatasetEvaluator.Candidate> preview = new ArrayList<>();
        List<DatasetEvaluator.Issue> issues = new ArrayList<>();
        Map<String, Integer> riskCounts = new TreeMap<>();
        int[] candidates = {0};
        try (InputStream in = storage.get(d.getObjectKey())) {
            var result = evaluator.evaluate(in, formatOf(d), c -> {
                candidates[0]++;
                riskCounts.merge(c.risk(), 1, Integer::sum);
                if (preview.size() < PREVIEW) {
                    preview.add(c);
                }
            }, i -> {
                if (issues.size() < ISSUES) {
                    issues.add(i);
                }
            });
            Map<String, Object> analysis = new LinkedHashMap<>();
            analysis.put("columns", result.header().columns());
            analysis.put("ignoredColumns", result.header().unknown());
            analysis.put("riskCounts", riskCounts);
            analysis.put("preview", preview.stream().map(c -> Map.of("line", c.line(), "name", c.name(), "category", c.category(),
                    "template", c.template(), "risk", c.risk(), "os", c.supportedOs(), "parameters", c.parameters().stream().map(p -> p.name()).toList())).toList());
            analysis.put("issues", issues);
            update(id, x -> {
                x.setTotalRecords(result.total());
                x.setCandidateRecords(candidates[0]);
                x.setInvalidRecords(result.invalid());
                x.setNonRhelRecords(result.nonLinux());
                x.setDuplicateRecords(result.duplicates());
                x.setRejectedRecords(result.invalid() + result.nonLinux());
                x.setAnalysis(write(analysis));
                x.setStatus("READY_FOR_REVIEW");
                x.setErrorMessage(null);
            });
            audit.record(d.getUploadedBy(), "DATASET_ANALYZED", "DATASET", id, Map.of("total", result.total(), "candidates", candidates[0]));
        } catch (IllegalArgumentException e) {
            fail(id, e.getMessage());
        } catch (Exception e) {
            log.warn("Dataset {} analysis failed", id, e);
            fail(id, "Analysis failed: " + e.getClass().getSimpleName());
        }
    }

    public DatasetDtos.DatasetView confirm(Long adminId, Long id) {
        tx.executeWithoutResult(s -> {
            DatasetImport d = load(id);
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
        worker.execute(() -> importRows(id));
        return get(id);
    }

    public DatasetDtos.DatasetView reject(Long adminId, Long id, String reason) {
        tx.executeWithoutResult(s -> {
            DatasetImport d = load(id);
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
            DatasetImport d = load(id);
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

    /**
     * Import re-reads the stored original and re-evaluates every row (de-duplication against the Command Bank is
     * repeated because it may have changed since analysis). Risk is computed server-side; every imported command is
     * approved, and HIGH-risk ones still need approval each time they run.
     */
    void importRows(Long id) {
        DatasetImport d = load(id);
        int[] processed = {0}, added = {0}, failed = {0};
        try (InputStream in = storage.get(d.getObjectKey())) {
            var result = evaluator.evaluate(in, formatOf(d), c -> {
                try {
                    tx.executeWithoutResult(s -> {
                        if (commands.existsByNormalizedTemplate(CommandDefinition.normalize(c.template()))) {
                            return;
                        }
                        var cmd = new CommandDefinition();
                        cmd.setName(c.name());
                        cmd.setDescription(c.description());
                        cmd.setCategory(c.category());
                        cmd.setAction(c.action());
                        cmd.setResourceType(c.resourceType());
                        cmd.setCommandTemplate(c.template());
                        cmd.setParametersSchema(templates.serialize(c.parameters()));
                        var r = CommandRiskAnalyzer.Risk.valueOf(c.risk());
                        cmd.setRiskLevel(r.name());
                        cmd.setRequiresApproval(r == CommandRiskAnalyzer.Risk.HIGH);
                        cmd.setSource("DATASET");
                        cmd.setSupportedOs(c.supportedOs());
                        cmd.setDatasetImportId(id);
                        cmd.setCreatedBy(d.getUploadedBy());
                        cmd.setStatus(CommandDefinition.APPROVED);
                        cmd.setApprovedBy(d.getReviewedBy());
                        cmd.setApprovedAt(Instant.now());
                        embeddings.index(commands.save(cmd));
                        added[0]++;
                    });
                } catch (RuntimeException e) {
                    failed[0]++;
                    log.warn("Dataset {} row {} failed: {}", id, c.line(), e.getMessage());
                }
                processed[0]++;
                if (processed[0] % 25 == 0) {
                    update(id, x -> {
                        x.setProcessedRecords(processed[0]);
                        x.setAddedRecords(added[0]);
                        x.setFailedRecords(failed[0]);
                    });
                }
            }, i -> { });
            update(id, x -> {
                x.setProcessedRecords(processed[0]);
                x.setAddedRecords(added[0]);
                x.setFailedRecords(failed[0]);
                x.setDuplicateRecords(result.duplicates() + (processed[0] - added[0] - failed[0]));
                x.setEmbeddingProvider(embeddingProvider.provider());
                x.setEmbeddingModel(embeddingProvider.model());
                x.setStatus("COMPLETED");
                x.setFinishedAt(Instant.now());
            });
            audit.record(d.getReviewedBy(), "DATASET_IMPORTED", "DATASET", id, Map.of("added", added[0], "failed", failed[0]));
        } catch (Exception e) {
            log.warn("Dataset {} import failed", id, e);
            update(id, x -> {
                x.setProcessedRecords(processed[0]);
                x.setAddedRecords(added[0]);
                x.setFailedRecords(failed[0]);
            });
            fail(id, "Import failed after " + processed[0] + " rows: " + (e instanceof IllegalArgumentException ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

    void resumeAfterRestart() {
        for (DatasetImport d : repo.findByStatusIn(List.of("UPLOADED", "ANALYZING", "IMPORTING"))) {
            if ("IMPORTING".equals(d.getStatus())) {
                fail(d.getId(), "Import interrupted by a server restart after " + d.getProcessedRecords() + " rows");
            } else {
                Long id = d.getId();
                update(id, x -> x.setStatus("UPLOADED"));
                worker.execute(() -> analyze(id));
            }
        }
    }

    private boolean transition(Long id, Set<String> from, String to) {
        Boolean ok = tx.execute(s -> {
            DatasetImport d = load(id);
            if (!from.contains(d.getStatus())) {
                return false;
            }
            d.setStatus(to);
            if (d.getStartedAt() == null) {
                d.setStartedAt(Instant.now());
            }
            repo.save(d);
            return true;
        });
        return Boolean.TRUE.equals(ok);
    }

    private void fail(Long id, String message) {
        update(id, x -> {
            x.setStatus("FAILED");
            x.setErrorMessage(message);
            x.setFinishedAt(Instant.now());
        });
        audit.record(null, "DATASET_FAILED", "DATASET", id, Map.of("error", message));
    }

    private void update(Long id, java.util.function.Consumer<DatasetImport> change) {
        tx.executeWithoutResult(s -> {
            DatasetImport d = load(id);
            change.accept(d);
            repo.save(d);
        });
    }

    private DatasetImport load(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Dataset"));
    }

    private Object readAnalysis(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return json.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private String write(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
