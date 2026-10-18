package com.autoops.dataset.service;

import com.autoops.audit.service.AuditService;
import com.autoops.dataset.entity.DatasetImport;
import com.autoops.files.service.ObjectStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;

@Service
public class DatasetAnalysis {
    private static final Logger log = LoggerFactory.getLogger(DatasetAnalysis.class);
    private final DatasetEvaluator evaluator;
    private final ObjectStorageService storage;
    private final AuditService audit;
    private final DatasetState state;

    public DatasetAnalysis(DatasetEvaluator evaluator, ObjectStorageService storage, AuditService audit, DatasetState state) {
        this.evaluator = evaluator;
        this.storage = storage;
        this.audit = audit;
        this.state = state;
    }

    private static final int PREVIEW = 25;
    private static final int ISSUES = 200;

    /** Imports created before JSON support are all CSV, so an unknown extension falls back to CSV. */
    private static DatasetFormat formatOf(DatasetImport d) {
        return DatasetFormat.fromFilename(d.getFilename()).orElse(DatasetFormat.CSV);
    }

    /** Background analysis: counts, issues and a preview. No command is created here. */
    void analyze(Long id) {
        if (!state.transition(id, Set.of("UPLOADED", "ANALYZING"), "ANALYZING")) {
            return;
        }
        DatasetImport d = state.load(id);
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
            state.update(id, x -> {
                x.setTotalRecords(result.total());
                x.setCandidateRecords(candidates[0]);
                x.setInvalidRecords(result.invalid());
                x.setNonLinuxRecords(result.nonLinux());
                x.setDuplicateRecords(result.duplicates());
                x.setRejectedRecords(result.invalid() + result.nonLinux());
                x.setAnalysis(state.write(analysis));
                x.setStatus("READY_FOR_REVIEW");
                x.setErrorMessage(null);
            });
            audit.record(d.getUploadedBy(), "DATASET_ANALYZED", "DATASET", id, Map.of("total", result.total(), "candidates", candidates[0]));
        } catch (IllegalArgumentException e) {
            state.fail(id, e.getMessage());
        } catch (Exception e) {
            log.warn("Dataset {} analysis failed", id, e);
            state.fail(id, "Analysis failed: " + e.getClass().getSimpleName());
        }
    }

}
