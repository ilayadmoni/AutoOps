package com.autoops.dataset.service;

import java.io.InputStream;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Consumer;

/** Supported dataset file formats, chosen by file extension. Both parse into the same rows. */
public enum DatasetFormat {
    CSV(".csv", "text/csv"),
    JSON(".json", "application/json");

    private final String extension;
    private final String contentType;

    DatasetFormat(String extension, String contentType) {
        this.extension = extension;
        this.contentType = contentType;
    }

    public String extension() {
        return extension;
    }

    public String contentType() {
        return contentType;
    }

    public static Optional<DatasetFormat> fromFilename(String filename) {
        String name = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        for (DatasetFormat f : values()) {
            if (name.endsWith(f.extension)) {
                return Optional.of(f);
            }
        }
        return Optional.empty();
    }

    public DatasetCsvParser.Header parse(InputStream in, Consumer<DatasetCsvParser.Row> rows) {
        return this == JSON ? DatasetJsonParser.parse(in, rows) : DatasetCsvParser.parse(in, rows);
    }
}
