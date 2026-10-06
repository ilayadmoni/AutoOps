package com.autoops.ai.tool.files;

import com.autoops.ai.tool.AITool;
import com.autoops.files.service.StoredFileService;
import org.springframework.stereotype.Component;

import java.util.Map;

/** File metadata only (never content). */
@Component
public class ListFilesTool implements AITool {
    private final StoredFileService files;

    public ListFilesTool(StoredFileService files) {
        this.files = files;
    }

    public String name() { return "list_files"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public String description() { return "List the user's uploaded files (id, name, size) for use in FILE_TRANSFER steps."; }

    public Map<String, Object> schema() { return Map.of("type", "object", "properties", Map.of()); }

    public Object execute(Map<String, Object> args, Long user) {
        return Map.of("files", files.list(user).stream().map(f -> Map.of("id", f.id(), "filename", f.filename(), "size", f.size())).toList());
    }
}
