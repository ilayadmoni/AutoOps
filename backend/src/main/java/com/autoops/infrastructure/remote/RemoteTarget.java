package com.autoops.infrastructure.remote;

/**
 * Everything needed to open a verified session. The trusted key is mandatory: there is no way to connect without one.
 */
public record RemoteTarget(String host, int port, String username, String password, SshHostKey trustedKey) {
    public RemoteTarget {
        if (trustedKey == null) {
            throw new RemoteException(RemoteException.Kind.UNTRUSTED_HOST, "SSH host key is not trusted for this machine");
        }
    }

    @Override
    public String toString() {
        return "RemoteTarget[" + username + "@" + host + ":" + port + "]";
    }
}
