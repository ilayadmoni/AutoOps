package com.autoops.dataset.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.dataset.entity.DatasetImport;
import com.autoops.dataset.repository.DatasetImportRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;

@Service
public class DatasetState {
    private static final Logger log = LoggerFactory.getLogger(DatasetState.class);
    private final DatasetImportRepository repo;
    private final TransactionTemplate tx;
    private final AuditService audit;
    private final ObjectMapper json;

    public DatasetState(DatasetImportRepository repo, TransactionTemplate tx, AuditService audit, ObjectMapper json) {
        this.repo = repo;
        this.tx = tx;
        this.audit = audit;
        this.json = json;
    }

    boolean transition(Long id, Set<String> from, String to) {
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

    void fail(Long id, String message) {
        update(id, x -> {
            x.setStatus("FAILED");
            x.setErrorMessage(message);
            x.setFinishedAt(Instant.now());
        });
        audit.record(null, "DATASET_FAILED", "DATASET", id, Map.of("error", message));
    }

    void update(Long id, java.util.function.Consumer<DatasetImport> change) {
        tx.executeWithoutResult(s -> {
            DatasetImport d = load(id);
            change.accept(d);
            repo.save(d);
        });
    }

    DatasetImport load(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("Dataset"));
    }

    Object readAnalysis(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return json.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    String write(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
