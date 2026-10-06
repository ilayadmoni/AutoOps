package com.autoops.machine.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.service.MachineService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/machines")
public class MachineController {
    private final MachineService service;
    private final CurrentUser current;

    public MachineController(MachineService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @GetMapping
    public List<MachineDtos.Response> list() {
        return service.list(current.id());
    }

    @GetMapping("/{id}")
    public MachineDtos.Response get(@PathVariable Long id) {
        return service.get(current.id(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MachineDtos.Response create(@Valid @RequestBody MachineDtos.Upsert r) {
        return service.create(current.id(), r);
    }

    @PutMapping("/{id}")
    public MachineDtos.Response update(@PathVariable Long id, @Valid @RequestBody MachineDtos.Upsert r) {
        return service.update(current.id(), id, r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(current.id(), id);
    }
}
