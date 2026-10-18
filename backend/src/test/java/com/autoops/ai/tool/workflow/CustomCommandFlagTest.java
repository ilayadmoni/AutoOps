package com.autoops.ai.tool.workflow;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CustomCommandFlagTest {
    private static Map<String, Object> draft(Map<String, Object> node) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("name", "Run Docker Compose");
        d.put("nodes", new ArrayList<>(List.of(new LinkedHashMap<>(node))));
        return d;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> node(Map<String, Object> d) {
        return (Map<String, Object>) ((List<?>) d.get("nodes")).get(0);
    }

    @Test
    void aTrueFlagWithoutCommandTextIsRejected() {
        var d = draft(Map.of("key", "s1", "type", "COMMAND", "name", "Start Docker Compose", "customCommand", true));
        assertThat(ProposeWorkflowDraftTool.flagCommands(d)).containsExactly("s1");
    }

    @Test
    void theCommandTextIsTakenFromWhereTheModelPutIt() {
        var d = draft(Map.of("key", "s1", "type", "COMMAND", "name", "Start", "customCommand", true, "command", " docker compose up -d "));
        assertThat(ProposeWorkflowDraftTool.flagCommands(d)).isEmpty();
        assertThat(node(d).get("customCommand")).isEqualTo("docker compose up -d");
    }

    @Test
    void realCommandTextAndFalseFlagsPassThrough() {
        var text = draft(Map.of("key", "s1", "type", "COMMAND", "name", "Start", "customCommand", "docker compose up"));
        assertThat(ProposeWorkflowDraftTool.flagCommands(text)).isEmpty();
        assertThat(node(text).get("customCommand")).isEqualTo("docker compose up");

        var off = draft(Map.of("key", "s1", "type", "COMMAND", "name", "Restart", "customCommand", false, "commandDefinitionId", 4));
        assertThat(ProposeWorkflowDraftTool.flagCommands(off)).isEmpty();
        assertThat(node(off)).doesNotContainKey("customCommand");
    }
}
