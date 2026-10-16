package com.autoops.machine.controller;

import com.autoops.common.error.ApiException;
import com.autoops.common.security.CurrentUser;
import com.autoops.machine.dto.MachineImportDtos.*;
import com.autoops.machine.service.MachineImportService;
import com.autoops.machine.service.MobaSessionParser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.Locale;

@RestController
@RequestMapping("/api/machines/import")
public class MachineImportController {
    private final MachineImportService service;
    private final CurrentUser current;

    public MachineImportController(MachineImportService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @PostMapping(value = "/preview", consumes = "multipart/form-data")
    public Preview preview(@RequestPart("file") MultipartFile file) { return service.preview(read(file)); }

    @PostMapping(consumes = "multipart/form-data")
    public Result execute(@RequestPart("file") MultipartFile file, @Valid @RequestPart("selection") Request request) {
        return service.execute(current.id(), read(file), request);
    }

    private byte[] read(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".mxtsessions")
                || file.isEmpty() || file.getSize() > MobaSessionParser.MAX_BYTES)
            throw ApiException.badRequest("INVALID_SESSION_FILE", "Choose a .mxtsessions file up to 2 MB");
        try { return file.getBytes(); }
        catch (IOException e) { throw ApiException.badRequest("INVALID_SESSION_FILE", "Cannot read session file"); }
    }
}
