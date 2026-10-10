package com.autoops.execution.plan;

import com.autoops.infrastructure.remote.OsFamily;

import java.util.Set;

/**
 * A step resolved server-side immediately before use. {@code resolvedCommand} is the exact command text executed
 * (before the execution-layer sudo wrapper), built from approved templates and validated parameters only.
 * {@code supportedOs} is the Linux families the step can run on; non-command steps run on any Linux.
 */
public record ResolvedStep(PlanStep step, String type, String originalCommand, String resolvedCommand, String riskLevel,
                           boolean runWithSudo, int timeoutSeconds, FileSource file, String destinationPath,
                           Set<OsFamily> supportedOs) {

    /** Metadata of a stored file to transfer. */
    public record FileSource(Long id, String objectKey, long size, String checksum, String filename) {
    }
}
