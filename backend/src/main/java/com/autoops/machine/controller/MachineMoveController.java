package com.autoops.machine.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.service.MachineMoveService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/machines/move")
public class MachineMoveController {
    public record Request(@NotEmpty @Size(max = 2000) List<@NotNull @Positive Long> machineIds, @Positive Long folderId) {}
    private final MachineMoveService service;
    private final CurrentUser current;
    public MachineMoveController(MachineMoveService service, CurrentUser current) { this.service = service; this.current = current; }
    @PostMapping
    public List<MachineDtos.Response> move(@Valid @RequestBody Request request) {
        return service.move(current.id(), request.machineIds(), request.folderId());
    }
}
