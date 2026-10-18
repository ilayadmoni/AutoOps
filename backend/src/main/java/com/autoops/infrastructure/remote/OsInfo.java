package com.autoops.infrastructure.remote;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Parsed /etc/os-release. */
public record OsInfo(String id, String idLike, String name, String versionId, String prettyName) {
    public static OsInfo parse(String osRelease) {
        Map<String, String> v = new HashMap<>();
        if (osRelease != null) {
            for (String line : osRelease.split("\\R")) {
                int eq = line.indexOf('=');
                if (eq > 0) {
                    String value = line.substring(eq + 1).trim();
                    if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length() - 1);
                    }
                    v.put(line.substring(0, eq).trim(), value);
                }
            }
        }
        return new OsInfo(v.getOrDefault("ID", ""), v.getOrDefault("ID_LIKE", ""), v.getOrDefault("NAME", ""),
                v.getOrDefault("VERSION_ID", ""), v.getOrDefault("PRETTY_NAME", ""));
    }

    public boolean known() {
        return !id.isBlank();
    }

    /** Distribution family (RPM, DEBIAN, SUSE...), or empty for a distro outside the known families. */
    public Optional<OsFamily> family() {
        return OsFamily.ofRelease(id, idLike);
    }

    public String display() {
        return prettyName.isBlank() ? (name + " " + versionId).trim() : prettyName;
    }
}
