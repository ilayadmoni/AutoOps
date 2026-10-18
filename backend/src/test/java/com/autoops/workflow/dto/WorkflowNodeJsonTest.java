package com.autoops.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowNodeJsonTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void customCommandIsSerializedAsItsTextNotAFlag() throws Exception {
        var node = new WorkflowDtos.Node("s1", "COMMAND", "Run Docker Compose", null, false, null, null,
                null, null, false, 300, null, null, null, null, null, null, null, null, null, "docker compose up -d");

        JsonNode out = json.readTree(json.writeValueAsString(node));

        assertThat(out.get("customCommand").isTextual()).isTrue();
        assertThat(out.get("customCommand").asText()).isEqualTo("docker compose up -d");
        assertThat(json.treeToValue(out, WorkflowDtos.Node.class).customCommand()).isEqualTo("docker compose up -d");
    }
}
