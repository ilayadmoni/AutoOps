package com.autoops.execution.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.realtime.ExecutionEventPublisher;
import com.autoops.execution.service.ExecutionControlService;
import com.autoops.execution.service.ExecutionQueryService;
import com.autoops.execution.service.ExecutionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/executions")
public class ExecutionController {
    private final ExecutionService executions;
    private final ExecutionQueryService queries;
    private final ExecutionControlService control;
    private final ExecutionEventPublisher events;
    private final CurrentUser current;

    public ExecutionController(ExecutionService executions, ExecutionQueryService queries, ExecutionControlService control,
                               ExecutionEventPublisher events, CurrentUser current) {
        this.executions = executions;
        this.queries = queries;
        this.control = control;
        this.events = events;
        this.current = current;
    }

    @PostMapping("/commands")
    @ResponseStatus(HttpStatus.CREATED)
    public ExecutionDtos.Detail runCommand(@Valid @RequestBody ExecutionDtos.StartCommand r) {
        return executions.startCommand(current.get(), r);
    }

    @GetMapping
    public ExecutionDtos.Page<ExecutionDtos.Summary> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return queries.list(current.get(), false, page, size);
    }

    @GetMapping("/{id}")
    public ExecutionDtos.Detail detail(@PathVariable Long id) {
        return queries.detail(current.get(), id);
    }

    @PostMapping("/{id}/stop")
    public ExecutionDtos.Detail stop(@PathVariable Long id) {
        return control.stop(current.get(), id);
    }

    @PostMapping("/steps/{stepRunId}/retry")
    public ExecutionDtos.Detail retry(@PathVariable Long stepRunId, @RequestBody(required = false) ExecutionDtos.Retry r) {
        return control.retry(current.get(), stepRunId, r != null && Boolean.TRUE.equals(r.highRiskAcknowledged()));
    }

    /** Live events. Authorization (owner or Admin) is checked before the stream opens. */
    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@PathVariable Long id) {
        queries.requireVisible(current.get(), id);
        return events.subscribe(id);
    }
}
