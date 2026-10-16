package com.autoops.execution.plan;

import com.autoops.common.error.ApiException;

final class TransferPaths {
    /** Validates an absolute destination; a trailing slash means "into this directory" and appends the file name. */
    static String destination(String path, String filename) {
        String p = absolutePath(path, "Destination path");
        if (p.endsWith("/")) {
            String safeName = filename.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safeName.isBlank() || safeName.startsWith(".") && safeName.replace(".", "").isEmpty()) {
                safeName = "upload";
            }
            p = p + safeName;
        }
        return p;
    }

    static String absolutePath(String path, String what) {
        if (path == null || path.isBlank()) {
            throw ApiException.validation(what + " is required");
        }
        String p = path.trim().replaceAll("/{2,}", "/");
        if (!p.startsWith("/") || p.length() > 1024 || p.chars().anyMatch(ch -> ch < 0x20 || ch == 0x7f)) {
            throw ApiException.validation(what + " must be an absolute path without control characters");
        }
        for (String part : p.split("/")) {
            if (part.equals("..") || part.equals(".")) {
                throw ApiException.validation(what + " may not contain '.' or '..' segments");
            }
        }
        if (p.equals("/")) {
            throw ApiException.validation(what + " cannot be the root directory");
        }
        return p;
    }

}
