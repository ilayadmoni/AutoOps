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

    public String description() { return "List files and folders for FILE_TRANSFER. Use folderName for folder labels. Folders extract automatically; destinationPath includes the final folder name. Copying into a parent directory appends folderName. Overwrite replaces all existing contents."; }

    public Map<String, Object> schema() { return Map.of("type", "object", "properties", Map.of()); }

    public Object execute(Map<String, Object> args, Long user) {
        return Map.of("files", files.list(user).stream().map(f -> Map.of("id", f.id(), "filename", f.folderName() == null ? f.filename() : f.folderName(), "size", f.size(),
                "kind", f.folderName() == null ? "FILE" : "FOLDER", "folderName", f.folderName() == null ? "" : f.folderName(),
                "fileCount", f.fileCount(), "checksum", f.checksum())).toList());
    }
}
