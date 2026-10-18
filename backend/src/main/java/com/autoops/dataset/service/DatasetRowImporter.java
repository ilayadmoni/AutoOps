package com.autoops.dataset.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.dataset.entity.DatasetImport;
import com.autoops.embedding.EmbeddingProvider;
import com.autoops.embedding.EmbeddingService;
import com.autoops.files.service.ObjectStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.time.Instant;
import java.util.*;

@Service
public class DatasetRowImporter {
    private static final Logger log = LoggerFactory.getLogger(DatasetRowImporter.class);
    private final DatasetEvaluator evaluator;
    private final ObjectStorageService storage;
    private final CommandDefinitionRepository commands;
    private final CommandTemplateService templates;
    private final EmbeddingService embeddings;
    private final EmbeddingProvider embeddingProvider;
    private final AuditService audit;
    private final TransactionTemplate tx;
    private final DatasetState state;

    public DatasetRowImporter(DatasetEvaluator evaluator, ObjectStorageService storage, CommandDefinitionRepository commands, CommandTemplateService templates, EmbeddingService embeddings, EmbeddingProvider embeddingProvider, AuditService audit, TransactionTemplate tx, DatasetState state) {
        this.evaluator = evaluator;
        this.storage = storage;
        this.commands = commands;
        this.templates = templates;
        this.embeddings = embeddings;
        this.embeddingProvider = embeddingProvider;
        this.audit = audit;
        this.tx = tx;
        this.state = state;
    }

    /** Imports created before JSON support are all CSV, so an unknown extension falls back to CSV. */
    private static DatasetFormat formatOf(DatasetImport d) {
        return DatasetFormat.fromFilename(d.getFilename()).orElse(DatasetFormat.CSV);
    }

    /**
     * Import re-reads the stored original and re-evaluates every row (de-duplication against the Command Bank is
     * repeated because it may have changed since analysis). Risk is computed server-side; every imported command is
     * approved, and HIGH-risk ones still need approval each time they run.
     */
    void importRows(Long id) {
        DatasetImport d = state.load(id);
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
                    state.update(id, x -> {
                        x.setProcessedRecords(processed[0]);
                        x.setAddedRecords(added[0]);
                        x.setFailedRecords(failed[0]);
                    });
                }
            }, i -> { });
            state.update(id, x -> {
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
            state.update(id, x -> {
                x.setProcessedRecords(processed[0]);
                x.setAddedRecords(added[0]);
                x.setFailedRecords(failed[0]);
            });
            state.fail(id, "Import failed after " + processed[0] + " rows: " + (e instanceof IllegalArgumentException ? e.getMessage() : e.getClass().getSimpleName()));
        }
    }

}
