package com.autoops.command.service;

import com.autoops.common.error.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CommandTemplateServiceTest {
    private final CommandTemplateService t = new CommandTemplateService(new ObjectMapper());

    @Test
    void resolvesWithQuotedValuesOnly() {
        var specs = t.validateTemplate("systemctl restart {{service}}", List.of(new ParameterSpec("service", null, "SERVICE", true, null, null, null)));
        assertEquals("systemctl restart 'nginx'", t.resolve("systemctl restart {{service}}", specs, Map.of("service", "nginx")));
        var e = assertThrows(ApiException.class, () -> t.resolve("systemctl restart {{service}}", specs, Map.of("service", "a;b")));
        assertTrue(e.fieldErrors().containsKey("service"));
    }

    @Test
    void rejectsSudoUnknownAndOptionInjection() {
        assertThrows(ApiException.class, () -> t.validateTemplate("sudo ls", null));
        var specs = t.validateTemplate("ls {{path}}", null);
        assertThrows(ApiException.class, () -> t.resolve("ls {{path}}", specs, Map.of("path", "-la")));
        assertThrows(ApiException.class, () -> t.validateValues(specs, Map.of("path", "/x", "extra", "1")));
    }
}
