package com.autoops.files.service;

import com.autoops.common.error.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

public final class FolderManifest {
    private FolderManifest() {}
    public record Entry(String path, long size, String checksum, boolean executable) {}
    public record Request(String name, List<String> paths, List<String> executablePaths) {}

    public static List<Entry> read(ObjectMapper json, String manifest) {
        try { return json.readValue(manifest, new TypeReference<List<Entry>>() {}); }
        catch (Exception e) { throw ApiException.validation("Folder package manifest is invalid"); }
    }
}
