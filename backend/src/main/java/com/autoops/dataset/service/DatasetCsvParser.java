package com.autoops.dataset.service;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Consumer;

/**
 * RFC 4180 CSV parsing (Apache Commons CSV): quoted fields, embedded commas/newlines, escaped quotes, header mapping,
 * blank lines and malformed-row reporting. Header names are case-insensitive and may use aliases.
 */
public final class DatasetCsvParser {
    public static final int MAX_ROWS = 50_000;
    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("name", "name"), Map.entry("title", "name"),
            Map.entry("description", "description"), Map.entry("desc", "description"),
            Map.entry("category", "category"),
            Map.entry("action", "action"),
            Map.entry("resource_type", "resource_type"), Map.entry("resourcetype", "resource_type"), Map.entry("resource", "resource_type"),
            Map.entry("command", "command"), Map.entry("command_template", "command"), Map.entry("template", "command"),
            Map.entry("os", "os"), Map.entry("supported_os", "os"), Map.entry("platform", "os"),
            Map.entry("parameters", "parameters"), Map.entry("parameters_schema", "parameters"));

    public record Row(long line, Map<String, String> values, boolean consistent) {
    }

    public record Header(List<String> columns, List<String> unknown) {
    }

    private DatasetCsvParser() {
    }

    /** Streams rows to {@code consumer}; returns the normalized header. Throws IllegalArgumentException on malformed input. */
    public static Header parse(InputStream input, Consumer<Row> consumer) {
        CSVFormat format = CSVFormat.RFC4180.builder()
                .setHeader().setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .setIgnoreSurroundingSpaces(true)
                .setAllowMissingColumnNames(true)
                .setTrim(true)
                .get();
        try (Reader reader = new InputStreamReader(input, StandardCharsets.UTF_8); CSVParser parser = CSVParser.parse(reader, format)) {
            Map<String, Integer> raw = parser.getHeaderMap();
            if (raw == null || raw.isEmpty()) {
                throw new IllegalArgumentException("The file has no header row");
            }
            Map<String, String> mapping = new LinkedHashMap<>();
            List<String> unknown = new ArrayList<>();
            for (String h : raw.keySet()) {
                String key = h == null ? "" : h.replace("﻿", "").trim().toLowerCase(Locale.ROOT).replace(' ', '_');
                String canonical = ALIASES.get(key);
                if (canonical == null) {
                    unknown.add(h);
                } else if (!mapping.containsValue(canonical)) {
                    mapping.put(h, canonical);
                }
            }
            if (!mapping.containsValue("name") || !mapping.containsValue("command")) {
                throw new IllegalArgumentException("Header must contain at least 'name' and 'command' columns");
            }
            int count = 0;
            for (CSVRecord record : parser) {
                if (++count > MAX_ROWS) {
                    throw new IllegalArgumentException("Dataset exceeds " + MAX_ROWS + " rows");
                }
                Map<String, String> values = new HashMap<>();
                mapping.forEach((header, canonical) -> {
                    if (record.isMapped(header) && record.isSet(header)) {
                        values.put(canonical, record.get(header));
                    }
                });
                consumer.accept(new Row(record.getRecordNumber() + 1, values, record.isConsistent()));
            }
            return new Header(List.copyOf(mapping.values()), unknown);
        } catch (UncheckedIOException e) {
            throw new IllegalArgumentException("Malformed CSV: " + rootMessage(e));
        } catch (IOException e) {
            throw new IllegalArgumentException("Unreadable CSV: " + rootMessage(e));
        }
    }

    private static String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null) {
            t = t.getCause();
        }
        String m = t.getMessage() == null ? "parse error" : t.getMessage();
        return m.length() > 200 ? m.substring(0, 200) : m;
    }
}
