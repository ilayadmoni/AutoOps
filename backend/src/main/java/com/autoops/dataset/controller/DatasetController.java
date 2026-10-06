package com.autoops.dataset.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.dataset.dto.DatasetDtos;
import com.autoops.dataset.service.DatasetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/datasets")
public class DatasetController {
    private final DatasetService datasets;
    private final CurrentUser current;

    public DatasetController(DatasetService datasets, CurrentUser current) {
        this.datasets = datasets;
        this.current = current;
    }

    @GetMapping
    public List<DatasetDtos.DatasetView> list() {
        return datasets.list();
    }

    @GetMapping("/{id}")
    public DatasetDtos.DatasetView get(@PathVariable Long id) {
        return datasets.get(id);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DatasetDtos.DatasetView upload(@RequestPart("file") MultipartFile file) {
        return datasets.upload(current.id(), file);
    }

    @PostMapping("/{id}/confirm")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DatasetDtos.DatasetView confirm(@PathVariable Long id, @Valid @RequestBody(required = false) DatasetDtos.Confirm r) {
        return datasets.confirm(current.id(), id, r == null ? null : r.approveUpTo());
    }

    @PostMapping("/{id}/reject")
    public DatasetDtos.DatasetView reject(@PathVariable Long id, @Valid @RequestBody(required = false) DatasetDtos.Reject r) {
        return datasets.reject(current.id(), id, r == null ? null : r.reason());
    }
}
