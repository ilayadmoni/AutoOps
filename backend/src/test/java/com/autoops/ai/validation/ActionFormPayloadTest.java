package com.autoops.ai.validation;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ActionFormPayloadTest {
    @Test
    void allowsOnlyKnownActionsAndNonSecretCredentialMetadata() {
        var result = ActionFormPayload.normalize(Map.of("action", "ADD_CREDENTIAL", "name", " Lab ", "username", " admin ",
                "password", "must-not-reach-client", "privateKey", "private-key", "url", "https://untrusted.test"));
        assertThat(result).contains(Map.of("action", "ADD_CREDENTIAL", "name", "Lab", "username", "admin"));
        assertThat(ActionFormPayload.normalize(Map.of("action", "RUN_WORKFLOW", "workflowId", 123, "command", "rm -rf /")))
                .contains(Map.of("action", "RUN_WORKFLOW"));
    }

    @Test
    void rejectsUnknownActionsAndOversizedMetadata() {
        assertThat(ActionFormPayload.normalize(Map.of("action", "RUN_COMMAND"))).isEmpty();
        assertThat(ActionFormPayload.normalize(Map.of("action", "UPLOAD_FILE"))).isEmpty();
        assertThat(ActionFormPayload.normalize(Map.of("action", 123))).isEmpty();
        assertThat(ActionFormPayload.normalize(Map.of("action", "ADD_CREDENTIAL", "username", "a".repeat(151)))).isEmpty();
    }
}
