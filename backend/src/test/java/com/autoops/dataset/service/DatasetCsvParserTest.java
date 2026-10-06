package com.autoops.dataset.service;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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
    void rhelApplicability() {
        assertTrue(DatasetEvaluator.rhelApplicable("rhel 9"));
        assertTrue(DatasetEvaluator.rhelApplicable("el8"));
        assertFalse(DatasetEvaluator.rhelApplicable("solaris"));
        assertFalse(DatasetEvaluator.rhelApplicable("ubuntu linux"));
    }
}
