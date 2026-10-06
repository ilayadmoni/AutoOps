package com.autoops.execution.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.service.ApprovalService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/approvals")
public class ApprovalController {
    private final ApprovalService service;
    private final CurrentUser current;

    public ApprovalController(ApprovalService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    /** The caller's pending approvals; Admins may pass all=true to see every pending approval. */
    @GetMapping("/pending")
    public List<ExecutionDtos.ApprovalView> pending(@RequestParam(defaultValue = "false") boolean all) {
        return service.pending(current.get(), all);
    }

    @PostMapping("/{id}/decision")
    public ExecutionDtos.ApprovalView decide(@PathVariable Long id, @Valid @RequestBody ExecutionDtos.Decision d) {
        return service.decide(current.get(), id, d);
    }
}
