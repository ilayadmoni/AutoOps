package com.autoops.command.controller;

import com.autoops.command.dto.CommandDtos;
import com.autoops.command.service.CommandService;
import com.autoops.common.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/commands")
public class CommandApprovalController {
    private final CommandService service;
    private final CurrentUser current;

    public CommandApprovalController(CommandService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @GetMapping
    public List<CommandDtos.CommandView> list(@RequestParam(defaultValue = "PENDING") String status) {
        return service.list(current.get(), null, null, null, status);
    }

    @PostMapping("/{id}/approve")
    public CommandDtos.CommandView approve(@PathVariable Long id) {
        return service.approve(current.get(), id);
    }

    @PostMapping("/{id}/reject")
    public CommandDtos.CommandView reject(@PathVariable Long id, @Valid @RequestBody(required = false) CommandDtos.Reject r) {
        return service.reject(current.get(), id, r == null ? null : r.reason());
    }
}
