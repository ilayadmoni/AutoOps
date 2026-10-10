package com.autoops.admin.controller;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** System-wide counters for the Admin overview. Returns aggregate numbers only, never entities. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    @PersistenceContext
    private EntityManager em;

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("activeUsers", count("select count(*) from users where status = 'ACTIVE'"));
        out.put("machines", count("select count(*) from machines where deleted_at is null"));
        out.put("approvedCommands", count("select count(*) from command_definitions where status = 'APPROVED'"));
        out.put("executions", count("select count(*) from executions"));
        out.put("activeExecutions", count("select count(*) from executions where status in ('PENDING','RUNNING','WAITING_APPROVAL')"));
        out.put("datasetsAwaitingReview", count("select count(*) from dataset_imports where status = 'READY_FOR_REVIEW'"));
        return out;
    }

    private long count(String sql) {
        return ((Number) em.createNativeQuery(sql).getSingleResult()).longValue();
    }
}
