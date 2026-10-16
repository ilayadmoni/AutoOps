package com.autoops.admin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class EnvironmentConfigurationServiceTest {
    @Test
    void displaysEffectiveValuesAndDefaultsWithoutEnumeratingHostVariables() {
        var environment = new MockEnvironment().withProperty("AI_MODEL", "env-model")
                .withProperty("autoops.ai.model", "overridden-model")
                .withProperty("UNRELATED_HOST_SECRET", "host-secret");
        var settings = new EnvironmentConfigurationService(environment).settings();
        assertThat(settings).anySatisfy(row -> {
            assertThat(row.name()).isEqualTo("AI_MODEL");
            assertThat(row.value()).isEqualTo("overridden-model");
        }).anySatisfy(row -> {
            assertThat(row.name()).isEqualTo("EXECUTION_MAX_CONCURRENCY");
            assertThat(row.value()).isEqualTo("3");
        });
        assertThat(settings).noneMatch(row -> row.name().equals("UNRELATED_HOST_SECRET"));
    }

    @Test
    void secretsNeverAppearInSerializedResponse() throws Exception {
        var environment = new MockEnvironment();
        for (String name : new String[] {"DATABASE_PASSWORD", "JWT_SECRET", "AUTOOPS_ADMIN_PASSWORD",
                "CREDENTIAL_ENCRYPTION_KEY", "AI_API_KEY", "EMBEDDING_API_KEY", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY"}) {
            environment.withProperty(name, "confidential-" + name);
        }
        var settings = new EnvironmentConfigurationService(environment).settings();
        assertThat(new ObjectMapper().writeValueAsString(settings)).doesNotContain("confidential-");
        assertThat(settings).filteredOn(row -> row.name().equals("AI_API_KEY")).singleElement()
                .satisfies(row -> {
                    assertThat(row.masked()).isTrue();
                    assertThat(row.configured()).isTrue();
                    assertThat(row.value()).isNull();
                });
    }

    @Test
    void masksEmbeddedUrlCredentialsAndReportsUnsetValues() {
        var environment = new MockEnvironment().withProperty("DATABASE_URL", "jdbc:postgresql://user:private@host/db")
                .withProperty("AI_BASE_URL", "https://provider.test?api_key=private")
                .withProperty("EMBEDDING_BASE_URL", "https://provider.test#private");
        var settings = new EnvironmentConfigurationService(environment).settings();
        assertThat(settings).filteredOn(row -> row.name().endsWith("URL")).allSatisfy(row -> {
            assertThat(row.masked()).isTrue();
            assertThat(row.value()).isNull();
        });
        assertThat(settings).filteredOn(row -> row.name().equals("AI_API_KEY")).singleElement()
                .satisfies(row -> assertThat(row.configured()).isFalse());
    }
}
