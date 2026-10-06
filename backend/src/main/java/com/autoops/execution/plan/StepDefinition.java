package com.autoops.execution.plan;

import java.util.Map;

/** Authoritative, server-side description of what one step does. Never built from client-supplied shell text. */
public sealed interface StepDefinition permits StepDefinition.Command, StepDefinition.FileTransfer, StepDefinition.WaitUntil {
    String type();

    record Command(Long commandDefinitionId, Map<String, String> parameters, boolean runWithSudo, int timeoutSeconds) implements StepDefinition {
        public String type() { return "COMMAND"; }
    }

    record FileTransfer(Long storedFileId, String destinationPath, boolean overwrite, boolean useSudo, int timeoutSeconds) implements StepDefinition {
        public String type() { return "FILE_TRANSFER"; }
    }

    /**
     * checkType: OUTPUT_CONTAINS / EXIT_CODE (run an approved command), FILE_EXISTS (target = path),
     * SERVICE_ACTIVE (target = systemd unit).
     */
    record WaitUntil(String checkType, Long commandDefinitionId, Map<String, String> parameters, String expectedOutput,
                     Integer expectedExitCode, String target, boolean runWithSudo, int intervalSeconds, int timeoutSeconds) implements StepDefinition {
        public String type() { return "WAIT_UNTIL"; }
    }
}
