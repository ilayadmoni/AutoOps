package com.autoops.command.controller;

import com.autoops.command.dto.CommandDtos;
import com.autoops.command.retrieval.CommandRetrievalService;
import com.autoops.command.service.CommandService;
import com.autoops.common.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/commands")
public class CommandController {
    private final CommandService service;
    private final CommandRetrievalService retrieval;
    private final CurrentUser current;

    public CommandController(CommandService service, CommandRetrievalService retrieval, CurrentUser current) {
        this.service = service;
        this.retrieval = retrieval;
        this.current = current;
    }

    @GetMapping
    public List<CommandDtos.CommandView> list(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) String category,
                                              @RequestParam(required = false) String risk,
                                              @RequestParam(required = false) String status) {
        return service.list(current.get(), q, category, risk, status);
    }

    @GetMapping("/search")
    public CommandRetrievalService.Result search(@RequestParam String q,
                                                 @RequestParam(required = false) String category,
                                                 @RequestParam(required = false) String maxRisk) {
        return retrieval.search(q, category, maxRisk, current.id());
    }

    @GetMapping("/{id}")
    public CommandDtos.CommandView get(@PathVariable Long id) {
        return service.get(current.get(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommandDtos.CommandView create(@Valid @RequestBody CommandDtos.Create x) {
        return service.create(current.get(), x);
    }

    /** Server-side resolution preview. The resolved string is informational only; executions resolve again server-side. */
    @PostMapping("/{id}/preview")
    public CommandDtos.PreviewResult preview(@PathVariable Long id, @RequestBody CommandDtos.Preview x) {
        return service.preview(current.get(), id, x.parameters(), Boolean.TRUE.equals(x.runWithSudo()));
    }
}
