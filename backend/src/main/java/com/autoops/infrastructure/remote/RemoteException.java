package com.autoops.infrastructure.remote;

/** A classified remote connection failure. Messages are safe to persist and display (no secrets, no stack traces). */
public class RemoteException extends RuntimeException {
    public enum Kind { UNTRUSTED_HOST, HOST_KEY_MISMATCH, CONNECTION_FAILED, AUTHENTICATION_FAILED, TIMEOUT, TRANSFER_FAILED, CANCELLED }

    private final Kind kind;
    private final String presentedFingerprint;

    public RemoteException(Kind kind, String message) {
        this(kind, message, null);
    }

    public RemoteException(Kind kind, String message, String presentedFingerprint) {
        super(message);
        this.kind = kind;
        this.presentedFingerprint = presentedFingerprint;
    }

    public Kind kind() {
        return kind;
    }

    public String presentedFingerprint() {
        return presentedFingerprint;
    }
}
