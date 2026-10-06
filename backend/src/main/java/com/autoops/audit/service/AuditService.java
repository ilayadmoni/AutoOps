package com.autoops.audit.service;

import com.autoops.audit.entity.AuditEvent;
import com.autoops.audit.repository.AuditEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Records security-relevant actions. Metadata is sanitized: keys that look secret are redacted and values are bounded.
 * Auditing never breaks the audited operation.
 */
@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private static final Set<String> SECRET_HINTS = Set.of("password", "secret", "token", "key", "hash", "cipher", "iv", "credential");
    private static final int MAX_VALUE = 300;

    private final AuditEventRepository repo;
    private final ObjectMapper json;
    private final TransactionTemplate tx;

    public AuditService(AuditEventRepository repo, ObjectMapper json, PlatformTransactionManager txManager) {
        this.repo = repo;
        this.json = json;
        this.tx = new TransactionTemplate(txManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Records the event once the surrounding transaction (if any) commits, so rolled-back actions are not audited as done. */
    public void record(Long userId, String action, String entityType, Long entityId, Map<String, ?> metadata) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    write(userId, action, entityType, entityId, metadata);
                }
            });
        } else {
            write(userId, action, entityType, entityId, metadata);
        }
    }

    /** Records the event immediately in its own transaction, even if the caller's transaction later rolls back (e.g. failed logins). */
    public void recordImmediately(Long userId, String action, String entityType, Long entityId, Map<String, ?> metadata) {
        write(userId, action, entityType, entityId, metadata);
    }

    private void write(Long userId, String action, String entityType, Long entityId, Map<String, ?> metadata) {
        try {
            String body = json.writeValueAsString(sanitize(metadata));
            tx.executeWithoutResult(status -> {
                AuditEvent e = new AuditEvent();
                e.setUserId(userId);
                e.setAction(action);
                e.setEntityType(entityType);
                e.setEntityId(entityId);
                e.setMetadata(body);
                repo.save(e);
            });
        } catch (Exception ex) {
            log.warn("Unable to record audit event {}: {}", action, ex.getMessage());
        }
    }

    static Map<String, Object> sanitize(Map<String, ?> metadata) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (metadata == null) {
            return out;
        }
        metadata.forEach((k, v) -> {
            String lower = k.toLowerCase(Locale.ROOT);
            boolean secret = SECRET_HINTS.stream().anyMatch(h -> lower.equals(h) || lower.endsWith(h) || lower.startsWith(h))
                    && !lower.endsWith("id") && !lower.contains("fingerprint") && !lower.contains("rotated");
            if (secret) {
                out.put(k, "[REDACTED]");
            } else if (v == null || v instanceof Number || v instanceof Boolean) {
                out.put(k, v);
            } else {
                String s = String.valueOf(v);
                out.put(k, s.length() > MAX_VALUE ? s.substring(0, MAX_VALUE) + "…" : s);
            }
        });
        return out;
    }
}
