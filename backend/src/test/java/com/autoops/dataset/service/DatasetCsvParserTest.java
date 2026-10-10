package com.autoops.dataset.service;

import com.autoops.infrastructure.remote.OsFamily;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DatasetCsvParserTest {
    private static List<DatasetCsvParser.Row> parse(String csv) {
        List<DatasetCsvParser.Row> rows = new ArrayList<>();
        DatasetCsvParser.parse(new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)), rows::add);
        return rows;
    }

    @Test
    void handlesQuotesCommasEscapesBlankLinesAndAliases() {
        var rows = parse("﻿Title,Command_Template,Desc\n\"a, b\",\"echo \"\"x\"\"\",\"multi\nline\"\n\n c ,ls, d \n");
        assertEquals(2, rows.size());
        assertEquals("a, b", rows.get(0).values().get("name"));
        assertEquals("echo \"x\"", rows.get(0).values().get("command"));
        assertEquals("multi\nline", rows.get(0).values().get("description"));
        assertEquals("c", rows.get(1).values().get("name"));
    }

    @Test
    void reportsInconsistentRows() {
        var rows = parse("name,command\nonly-one-field\n");
        assertFalse(rows.get(0).consistent());
    }

    @Test
    void rejectsMissingRequiredColumnsAndMalformedInput() {
        assertThrows(IllegalArgumentException.class, () -> parse("name,description\nx,y\n"));
        assertThrows(IllegalArgumentException.class, () -> parse("name,command\n\"open,echo\n"));
    }

    @Test
    void linuxApplicabilityAndFamilies() {
        assertEquals(EnumSet.of(OsFamily.RHEL), DatasetEvaluator.supportedFamilies("rhel 9, centos", "ls").orElseThrow());
        assertEquals(EnumSet.of(OsFamily.RHEL), DatasetEvaluator.supportedFamilies("el8", "ls").orElseThrow());
        assertEquals(EnumSet.of(OsFamily.DEBIAN), DatasetEvaluator.supportedFamilies("ubuntu linux", "ls").orElseThrow());
        assertEquals(EnumSet.of(OsFamily.LINUX), DatasetEvaluator.supportedFamilies("", "df -h").orElseThrow());
        assertEquals(EnumSet.of(OsFamily.LINUX), DatasetEvaluator.supportedFamilies("linux, macos", "df -h").orElseThrow());
        // A generic row is narrowed by its tool, so apt never lands as "any Linux".
        assertEquals(EnumSet.of(OsFamily.DEBIAN), DatasetEvaluator.supportedFamilies("linux", "apt install {{package}}").orElseThrow());
        assertTrue(DatasetEvaluator.supportedFamilies("solaris", "ls").isEmpty());
        assertTrue(DatasetEvaluator.supportedFamilies("windows; macOS", "dir").isEmpty());
    }
}
