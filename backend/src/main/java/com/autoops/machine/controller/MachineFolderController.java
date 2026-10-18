package com.autoops.machine.controller;

import com.autoops.machine.service.MachineFolderService;
import com.autoops.common.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/machine-folders")
public class MachineFolderController {
    private final MachineFolderService service;
    private final CurrentUser current;
    public MachineFolderController(MachineFolderService service, CurrentUser current) {
        this.service = service; this.current = current;
    }
    @GetMapping
    public List<MachineFolderService.Folder> list() { return service.list(); }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { service.delete(current.id(), id); }
}
