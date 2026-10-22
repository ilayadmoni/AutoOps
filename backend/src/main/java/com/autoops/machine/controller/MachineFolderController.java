package com.autoops.machine.controller;

import com.autoops.machine.service.MachineFolderService;
import com.autoops.machine.service.MachineFolderMoveService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import com.autoops.common.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/machine-folders")
public class MachineFolderController {
    private final MachineFolderService service;
    private final CurrentUser current;
    private final MachineFolderMoveService moves;
    public record Destination(@Positive Long folderId) {}
    public MachineFolderController(MachineFolderService service, CurrentUser current, MachineFolderMoveService moves) {
        this.service = service; this.current = current; this.moves = moves;
    }
    @GetMapping
    public List<MachineFolderService.Folder> list() { return service.list(); }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { service.delete(current.id(), id); }
    @PostMapping("/{id}/move")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void move(@PathVariable Long id, @Valid @RequestBody Destination destination) {
        moves.move(current.id(), id, destination.folderId());
    }
}
