package com.autoops.ai.provider;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OpenRouterContentTest {
    @Test
    void readsStringAndTextParts() {
        assertEquals("hello", OpenRouterAIProvider.extractContent("hello"));
        assertEquals("ab", OpenRouterAIProvider.extractContent(List.of(Map.of("type", "text", "text", "a"), Map.of("type", "image"), Map.of("text", "b"))));
    }

    @Test
    void nullAndUnknownShapesAreEmpty() {
        assertEquals("", OpenRouterAIProvider.extractContent(null));
        assertEquals("", OpenRouterAIProvider.extractContent(42));
    }
}
