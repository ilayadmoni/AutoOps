package com.autoops.command.controller;

import com.autoops.command.service.CommandDeletionService;
import com.autoops.common.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/commands")
public class CommandDeletionController {
    private final CommandDeletionService service;
    private final CurrentUser current;

    public CommandDeletionController(CommandDeletionService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { service.delete(current.get(), id); }
}
