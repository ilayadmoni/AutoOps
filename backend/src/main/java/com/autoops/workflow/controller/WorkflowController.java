package com.autoops.workflow.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.workflow.dto.WorkflowDtos;
import com.autoops.workflow.service.WorkflowRunService;
import com.autoops.workflow.service.WorkflowService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {
    private final WorkflowService service;
    private final WorkflowRunService runs;
    private final CurrentUser current;

    public WorkflowController(WorkflowService service, WorkflowRunService runs, CurrentUser current) {
        this.service = service;
        this.runs = runs;
        this.current = current;
    }

    @GetMapping
    public List<WorkflowDtos.Summary> list() {
        return service.list(current.id());
    }

    @GetMapping("/{id}")
    public WorkflowDtos.WorkflowView get(@PathVariable Long id) {
        return service.get(current.id(), id);
    }

    @PostMapping("/validate")
    public WorkflowDtos.ValidationResult validate(@Valid @RequestBody WorkflowDtos.Save draft) {
        return service.validate(current.id(), draft);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowDtos.WorkflowView create(@Valid @RequestBody WorkflowDtos.Save draft) {
        return service.create(current.id(), draft);
    }

    @PutMapping("/{id}")
    public WorkflowDtos.WorkflowView update(@PathVariable Long id, @Valid @RequestBody WorkflowDtos.Save draft) {
        return service.update(current.id(), id, draft);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(current.id(), id);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowDtos.WorkflowView duplicate(@PathVariable Long id) {
        return service.duplicate(current.id(), id);
    }

    @PostMapping("/{id}/run")
    @ResponseStatus(HttpStatus.CREATED)
    public ExecutionDtos.Detail run(@PathVariable Long id, @Valid @RequestBody ExecutionDtos.RunOptions options) {
        return runs.run(current.get(), id, options);
    }
}
