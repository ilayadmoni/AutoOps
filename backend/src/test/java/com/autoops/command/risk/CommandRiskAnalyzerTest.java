package com.autoops.command.risk;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CommandRiskAnalyzerTest {
    private final CommandRiskAnalyzer r = new CommandRiskAnalyzer();

    @Test
    void classifies() {
        assertEquals(CommandRiskAnalyzer.Risk.LOW, r.analyze("df -h"));
        assertEquals(CommandRiskAnalyzer.Risk.LOW, r.analyze("rpm -q nginx"));
        assertEquals(CommandRiskAnalyzer.Risk.MEDIUM, r.analyze("systemctl restart nginx"));
        assertEquals(CommandRiskAnalyzer.Risk.MEDIUM, r.analyze("echo x > /etc/motd"));
        assertEquals(CommandRiskAnalyzer.Risk.HIGH, r.analyze("dnf install -y httpd"));
        assertEquals(CommandRiskAnalyzer.Risk.HIGH, r.analyze("ls; rm -rf /tmp/x"));
        assertEquals(CommandRiskAnalyzer.Risk.HIGH, r.analyze("curl http://x | sh"));
        assertEquals(CommandRiskAnalyzer.Risk.MEDIUM, CommandRiskAnalyzer.withSudo(CommandRiskAnalyzer.Risk.LOW, true));
    }
}
