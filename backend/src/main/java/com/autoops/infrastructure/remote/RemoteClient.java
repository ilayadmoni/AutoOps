package com.autoops.infrastructure.remote;

public interface RemoteClient {
    /** Performs only the SSH key exchange and returns the server's host key. No authentication is attempted. */
    SshHostKey discoverHostKey(String host, int port);

    /** Opens a session that only succeeds if the server presents exactly the trusted host key. */
    RemoteSession open(RemoteTarget target);
}
