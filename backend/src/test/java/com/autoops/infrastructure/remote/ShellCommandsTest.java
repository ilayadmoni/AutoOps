package com.autoops.infrastructure.remote;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShellCommandsTest {
    @Test
    void quotesSingleQuotes() {
        assertEquals("'it'\"'\"'s; rm -rf /'", ShellCommands.quote("it's; rm -rf /"));
    }

    @Test
    void sudoWrapperDetachesStdin() {
        String wrapped = ShellCommands.withSudo("systemctl restart 'nginx'");
        assertTrue(wrapped.startsWith("sudo -S -p '' -- sh -c "));
        assertTrue(wrapped.contains("exec </dev/null; systemctl restart"));
    }
}
