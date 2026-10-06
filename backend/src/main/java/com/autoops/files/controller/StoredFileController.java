package com.autoops.files.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.service.StoredFileService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/files")
public class StoredFileController {
    private final StoredFileService files;
    private final CurrentUser current;

    public StoredFileController(StoredFileService files, CurrentUser current) {
        this.files = files;
        this.current = current;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public StoredFileService.FileView upload(@RequestPart("file") MultipartFile file) {
        return files.upload(file, current.id());
    }

    @GetMapping
    public List<StoredFileService.FileView> list() {
        return files.list(current.id());
    }

    @GetMapping("/{id}")
    public StoredFileService.FileView get(@PathVariable Long id) {
        return files.get(current.id(), id);
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<InputStreamResource> download(@PathVariable Long id) {
        StoredFile f = files.requireUsable(current.id(), id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(f.getOriginalFilename(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(f.getSize())
                .body(new InputStreamResource(files.open(f)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        files.delete(current.id(), id);
    }
}
