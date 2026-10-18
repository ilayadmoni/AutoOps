package com.autoops.machine.controller;

import com.autoops.machine.service.MachineFolderService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/machine-folders")
public class MachineFolderController {
    private final MachineFolderService service;
    public MachineFolderController(MachineFolderService service) { this.service = service; }
    @GetMapping
    public List<MachineFolderService.Folder> list() { return service.list(); }
}
