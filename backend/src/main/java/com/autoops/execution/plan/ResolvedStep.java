package com.autoops.execution.plan;

/**
 * A step resolved server-side immediately before use. {@code resolvedCommand} is the exact command text executed
 * (before the execution-layer sudo wrapper), built from approved templates and validated parameters only.
 */
public record ResolvedStep(PlanStep step, String type, String originalCommand, String resolvedCommand, String riskLevel,
                           boolean runWithSudo, int timeoutSeconds, FileSource file, String destinationPath) {

    /** Metadata of a stored file to transfer. */
    public record FileSource(Long id, String objectKey, long size, String checksum, String filename) {
    }
}
