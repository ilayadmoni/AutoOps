package com.autoops.dataset.service;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DatasetJsonParserTest {
    private static List<DatasetCsvParser.Row> rows;

    private static DatasetCsvParser.Header parse(String json) {
        rows = new ArrayList<>();
        return DatasetJsonParser.parse(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)), rows::add);
    }

    @Test
    void parsesTopLevelArrayWithAliasesArraysAndParameters() {
        var header = parse("""
                [{"Title": " Restart ", "template": "systemctl restart {{service}}", "os": ["rhel", "centos"],
                  "parameters": [{"name": "service", "type": "SERVICE"}], "extra": 1},
                 {"name": "Disk", "command": "df -h", "category": null}]
                """);
        assertEquals(2, rows.size());
        var first = rows.get(0).values();
        assertEquals("Restart", first.get("name"));
        assertEquals("systemctl restart {{service}}", first.get("command"));
        assertEquals("rhel,centos", first.get("os"));
        assertEquals("[{\"name\":\"service\",\"type\":\"SERVICE\"}]", first.get("parameters"));
        assertFalse(rows.get(1).values().containsKey("category"));
        assertEquals(1, rows.get(0).line());
        assertEquals(2, rows.get(1).line());
        assertTrue(header.columns().containsAll(List.of("name", "command", "os", "parameters")));
        assertEquals(List.of("extra"), header.unknown());
    }

    @Test
    void readsCommandsArrayInsideAnObject() {
        parse("{\"version\": 1, \"meta\": {\"a\": [1]}, \"commands\": [{\"name\": \"Uptime\", \"command\": \"uptime\"}]}");
        assertEquals(1, rows.size());
        assertEquals("uptime", rows.get(0).values().get("command"));
    }

    @Test
    void acceptsAnEmptyArray() {
        assertTrue(parse("[]").columns().isEmpty());
        assertTrue(rows.isEmpty());
    }

    @Test
    void rejectsMalformedOrWrongShapes() {
        assertThrows(IllegalArgumentException.class, () -> parse("[{\"name\": \"x\""));
        assertThrows(IllegalArgumentException.class, () -> parse("\"text\""));
        assertThrows(IllegalArgumentException.class, () -> parse("{\"other\": []}"));
        assertThrows(IllegalArgumentException.class, () -> parse("[1, 2]"));
        assertThrows(IllegalArgumentException.class, () -> parse("[{\"name\": \"x\", \"description\": \"y\"}]"));
    }

    @Test
    void picksFormatFromFilename() {
        assertEquals(DatasetFormat.JSON, DatasetFormat.fromFilename("Commands.JSON").orElseThrow());
        assertEquals(DatasetFormat.CSV, DatasetFormat.fromFilename("a.csv").orElseThrow());
        assertTrue(DatasetFormat.fromFilename("a.txt").isEmpty());
    }
}
