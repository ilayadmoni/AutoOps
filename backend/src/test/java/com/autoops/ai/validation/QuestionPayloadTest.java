package com.autoops.ai.validation;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class QuestionPayloadTest {
    @Test
    @SuppressWarnings("unchecked")
    void normalizesValidQuestion() {
        var out = QuestionPayload.normalize(Map.of("question", "  Build a workflow? ", "options", List.of(
                Map.of("label", " Build workflow ", "description", "Copies the file"), Map.of("label", "Just answer")))).orElseThrow();
        assertEquals("Build a workflow?", out.get("question"));
        var options = (List<Map<String, Object>>) out.get("options");
        assertEquals(2, options.size());
        assertEquals("Build workflow", options.get(0).get("label"));
        assertEquals("Copies the file", options.get(0).get("description"));
        assertFalse(options.get(1).containsKey("description"));
        assertEquals(true, out.get("allowOther"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void dropsBlankAndDuplicateLabelsAndCapsCount() {
        var out = QuestionPayload.normalize(Map.of("question", "Q", "allowOther", false, "options",
                List.of("a", "A", " ", "b", "c", "d", "e", "f"))).orElseThrow();
        var labels = ((List<Map<String, Object>>) out.get("options")).stream().map(o -> o.get("label")).toList();
        assertEquals(List.of("a", "b", "c", "d", "e"), labels);
        assertEquals(false, out.get("allowOther"));
    }

    @Test
    void clipsLongText() {
        var out = QuestionPayload.normalize(Map.of("question", "q".repeat(500), "options", List.of("x".repeat(200), "y"))).orElseThrow();
        assertTrue(((String) out.get("question")).length() <= QuestionPayload.MAX_QUESTION + 1);
    }

    @Test
    void rejectsUnusableQuestions() {
        assertTrue(QuestionPayload.normalize(Map.of("question", " ", "options", List.of("a", "b"))).isEmpty());
        assertTrue(QuestionPayload.normalize(Map.of("question", "Q", "options", List.of("a", "a"))).isEmpty());
        assertTrue(QuestionPayload.normalize(Map.of("question", "Q")).isEmpty());
        assertTrue(QuestionPayload.normalize(null).isEmpty());
    }
}
