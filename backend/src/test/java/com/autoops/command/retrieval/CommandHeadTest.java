package com.autoops.command.retrieval;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CommandHeadTest {
    @Test
    void headIsProgramAndSubcommand() {
        assertThat(CommandRetrievalService.head("docker compose down")).isEqualTo("docker compose");
        assertThat(CommandRetrievalService.head("docker compose -f {{compose_file}} stop")).isEqualTo("docker compose");
        assertThat(CommandRetrievalService.head("systemctl restart {{service}}")).isEqualTo("systemctl restart");
    }

    @Test
    void headStopsAtFlagsPlaceholdersAndPaths() {
        assertThat(CommandRetrievalService.head("ls -la {{path}}")).isEqualTo("ls");
        assertThat(CommandRetrievalService.head("du /var/log")).isEqualTo("du");
        assertThat(CommandRetrievalService.head("env -i {{path}}")).isEqualTo("env");
        assertThat(CommandRetrievalService.head("")).isEmpty();
    }
}
