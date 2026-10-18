package com.autoops.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TextQuestionRecoveryTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void questionWrittenAsTextBecomesAnAskUserOperation() {
        String reply = """
                { "question": "How should the workflow be built?", "options": [ { "label": "Transfer docker-compose.yml then run docker compose up", "description": "Upload the file first, then start containers" }, { "label": "Just run docker compose up on the server", "description": "Execute the command directly without file transfer" } ], "allowOther": false }""";
        List<Map<String, Object>> ops = new ArrayList<>();

        String answer = AIChatSupport.recoverTextQuestion(json, reply, ops);

        assertThat(answer).isEmpty();
        assertThat(ops).singleElement().satisfies(op -> {
            assertThat(op.get("type")).isEqualTo("ASK_USER");
            assertThat(((Map<?, ?>) op.get("payload")).get("question")).isEqualTo("How should the workflow be built?");
        });
    }

    @Test
    void proseBeforeAFencedQuestionIsKept() {
        String reply = "I need one detail.\n```json\n{\"question\":\"Which file?\",\"options\":[{\"label\":\"a.yml\"},{\"label\":\"b.yml\"}]}\n```";
        List<Map<String, Object>> ops = new ArrayList<>();

        assertThat(AIChatSupport.recoverTextQuestion(json, reply, ops)).isEqualTo("I need one detail.");
        assertThat(ops).hasSize(1);
    }

    @Test
    void ordinaryRepliesAndRealToolQuestionsAreLeftAlone() {
        List<Map<String, Object>> ops = new ArrayList<>();
        assertThat(AIChatSupport.recoverTextQuestion(json, "Use `docker compose up -d` {{x}}", ops)).isEqualTo("Use `docker compose up -d` {{x}}");
        assertThat(ops).isEmpty();

        List<Map<String, Object>> asked = new ArrayList<>(List.of(Map.of("type", "ASK_USER", "payload", Map.of())));
        String text = "{\"question\":\"Q?\",\"options\":[{\"label\":\"a\"},{\"label\":\"b\"}]}";
        assertThat(AIChatSupport.recoverTextQuestion(json, text, asked)).isEqualTo(text);
        assertThat(asked).hasSize(1);
    }
}
