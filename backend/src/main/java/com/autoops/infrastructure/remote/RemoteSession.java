package com.autoops.infrastructure.remote;

import java.io.InputStream;
import java.util.function.BooleanSupplier;

/** An authenticated SSH session whose server identity was verified against the persisted trusted key. */
public interface RemoteSession extends AutoCloseable {
    /**
     * Runs a server-built command. {@code stdin} (may be null) is written once and closed; it is used to pass the sudo
     * password without placing it on the command line.
     */
    ExecResult exec(String command, String stdin, int timeoutSeconds, BooleanSupplier cancelled, OutputListener listener);

    default ExecResult exec(String command, int timeoutSeconds) {
        return exec(command, null, timeoutSeconds, () -> false, null);
    }

    /** Uploads exactly {@code size} bytes over SFTP to {@code remotePath}. */
    void upload(InputStream data, long size, String remotePath, int timeoutSeconds);

    @Override
    void close();
}
