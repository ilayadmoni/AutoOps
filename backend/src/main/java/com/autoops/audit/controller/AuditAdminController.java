package com.autoops.audit.controller;

import com.autoops.audit.entity.AuditEvent;
import com.autoops.audit.repository.AuditEventRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/admin/audit")
public class AuditAdminController {
    private final AuditEventRepository repo;

    public AuditAdminController(AuditEventRepository repo) {
        this.repo = repo;
    }

    public record AuditView(Long id, Long userId, String action, String entityType, Long entityId, String metadata, Instant createdAt) {
        static AuditView from(AuditEvent e) {
            return new AuditView(e.getId(), e.getUserId(), e.getAction(), e.getEntityType(), e.getEntityId(), e.getMetadata(), e.getCreatedAt());
        }
    }

    public record AuditPage(List<AuditView> items, int page, int size, long total) {
    }

    @GetMapping
    public AuditPage list(@RequestParam(required = false) Long userId,
                          @RequestParam(required = false) String action,
                          @RequestParam(required = false) String entityType,
                          @RequestParam(defaultValue = "0") int page,
                          @RequestParam(defaultValue = "50") int size) {
        int boundedSize = Math.max(1, Math.min(size, 200));
        var result = repo.search(userId, blankToNull(action), blankToNull(entityType), PageRequest.of(Math.max(page, 0), boundedSize));
        return new AuditPage(result.getContent().stream().map(AuditView::from).toList(), result.getNumber(), boundedSize, result.getTotalElements());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
