package com.autoops.embedding;

import com.autoops.audit.service.AuditService;
import com.autoops.common.security.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/embeddings")
public class EmbeddingAdminController {
    private final EmbeddingService embeddings;
    private final AuditService audit;
    private final CurrentUser current;

    public EmbeddingAdminController(EmbeddingService embeddings, AuditService audit, CurrentUser current) {
        this.embeddings = embeddings;
        this.audit = audit;
        this.current = current;
    }

    @GetMapping
    public Map<String, Object> status() {
        return embeddings.status();
    }

    @PostMapping("/reindex")
    public Map<String, Object> reindex() {
        int n = embeddings.reindexAll();
        audit.record(current.id(), "EMBEDDINGS_REINDEXED", "COMMAND", null, Map.of("indexed", n));
        return Map.of("indexed", n, "status", embeddings.status());
    }
}
