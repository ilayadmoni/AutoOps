package com.autoops.dataset.service;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.function.Consumer;

/**
 * Streaming JSON dataset parsing. Accepts a top-level array of command objects, or an object holding that array under
 * {@code commands}, {@code items} or {@code data}. Keys use the same case-insensitive aliases as CSV headers.
 * {@code parameters} may be a JSON array (kept as JSON) and {@code os} may be an array of names (joined with commas).
 * Rows carry the 1-based item number in place of a line number.
 */
public final class DatasetJsonParser {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> CONTAINERS = Set.of("commands", "items", "data");

    private DatasetJsonParser() {
    }

    /** Streams rows to {@code consumer}; returns the columns seen. Throws IllegalArgumentException on malformed input. */
    public static DatasetCsvParser.Header parse(InputStream input, Consumer<DatasetCsvParser.Row> consumer) {
        Set<String> columns = new LinkedHashSet<>();
        Set<String> unknown = new LinkedHashSet<>();
        try (JsonParser parser = MAPPER.getFactory().createParser(input)) {
            JsonToken first = parser.nextToken();
            if (first == JsonToken.START_OBJECT && !seekContainer(parser)) {
                throw new IllegalArgumentException("The JSON object has no 'commands' array");
            } else if (first != JsonToken.START_OBJECT && first != JsonToken.START_ARRAY) {
                throw new IllegalArgumentException("The file must be a JSON array of commands");
            }
            long item = 0;
            while (parser.nextToken() != JsonToken.END_ARRAY) {
                if (++item > DatasetCsvParser.MAX_ROWS) {
                    throw new IllegalArgumentException("Dataset exceeds " + DatasetCsvParser.MAX_ROWS + " rows");
                }
                JsonNode node = MAPPER.readTree(parser);
                if (node == null || !node.isObject()) {
                    throw new IllegalArgumentException("Item " + item + " is not a JSON object");
                }
                consumer.accept(new DatasetCsvParser.Row(item, values(node, columns, unknown), true));
            }
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Malformed JSON: " + clip(e.getOriginalMessage()));
        } catch (IOException e) {
            throw new IllegalArgumentException("Unreadable JSON: " + clip(e.getMessage()));
        }
        if (!columns.isEmpty() && !(columns.contains("name") && columns.contains("command"))) {
            throw new IllegalArgumentException("Items must contain at least 'name' and 'command' fields");
        }
        return new DatasetCsvParser.Header(List.copyOf(columns), List.copyOf(unknown));
    }

    /** Advances inside a top-level object to the start of its command array; false when there is none. */
    private static boolean seekContainer(JsonParser parser) throws IOException {
        while (parser.nextToken() == JsonToken.FIELD_NAME) {
            String field = parser.currentName();
            JsonToken value = parser.nextToken();
            if (value == JsonToken.START_ARRAY && CONTAINERS.contains(field.toLowerCase(Locale.ROOT))) {
                return true;
            }
            parser.skipChildren();
        }
        return false;
    }

    private static Map<String, String> values(JsonNode node, Set<String> columns, Set<String> unknown) {
        Map<String, String> values = new HashMap<>();
        node.properties().forEach(e -> {
            String canonical = DatasetCsvParser.canonical(e.getKey());
            if (canonical == null) {
                unknown.add(e.getKey());
                return;
            }
            columns.add(canonical);
            String text = text(canonical, e.getValue());
            if (text != null && !values.containsKey(canonical)) {
                values.put(canonical, text.strip());
            }
        });
        return values;
    }

    private static String text(String column, JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isValueNode()) {
            return value.asText();
        }
        if (value.isArray() && !"parameters".equals(column)) {
            List<String> parts = new ArrayList<>();
            value.forEach(v -> parts.add(v.asText()));
            return String.join(",", parts);
        }
        return value.toString();
    }

    private static String clip(String m) {
        String s = m == null ? "parse error" : m;
        return s.length() > 200 ? s.substring(0, 200) : s;
    }
}
