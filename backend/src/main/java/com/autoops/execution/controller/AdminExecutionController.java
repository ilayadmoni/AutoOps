package com.autoops.execution.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.service.ExecutionQueryService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/executions")
public class AdminExecutionController {
    private final ExecutionQueryService queries;
    private final CurrentUser current;

    public AdminExecutionController(ExecutionQueryService queries, CurrentUser current) {
        this.queries = queries;
        this.current = current;
    }

    @GetMapping
    public ExecutionDtos.Page<ExecutionDtos.Summary> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return queries.list(current.get(), true, page, size);
    }
}
