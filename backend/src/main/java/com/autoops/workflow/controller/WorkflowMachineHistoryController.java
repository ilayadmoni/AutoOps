package com.autoops.workflow.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.workflow.service.WorkflowMachineHistoryService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/workflows/{id}/machine-history")
public class WorkflowMachineHistoryController {
    private final WorkflowMachineHistoryService service;
    private final CurrentUser current;
    public WorkflowMachineHistoryController(WorkflowMachineHistoryService service, CurrentUser current) {
        this.service = service; this.current = current;
    }
    @GetMapping
    public List<Long> list(@PathVariable Long id) { return service.machines(current.get(), id); }
}
