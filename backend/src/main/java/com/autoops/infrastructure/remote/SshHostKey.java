package com.autoops.infrastructure.remote;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * An SSH server public host key. The fingerprint follows OpenSSH semantics:
 * {@code SHA256:Base64WithoutPadding(SHA-256(raw public key blob))}.
 */
public record SshHostKey(String algorithm, String base64Key, String fingerprint) {

    public static SshHostKey fromBlob(byte[] blob) {
        return new SshHostKey(algorithmOf(blob), Base64.getEncoder().encodeToString(blob), fingerprint(blob));
    }

    public static SshHostKey fromBase64(String base64Key) {
        return fromBlob(Base64.getDecoder().decode(base64Key));
    }

    public byte[] blob() {
        return Base64.getDecoder().decode(base64Key);
    }

    public static String fingerprint(byte[] blob) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(blob);
            return "SHA256:" + Base64.getEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** The key blob starts with a uint32 length followed by the key type name (e.g. ssh-ed25519). */
    static String algorithmOf(byte[] blob) {
        if (blob.length < 4) {
            throw new IllegalArgumentException("Invalid host key");
        }
        int len = ByteBuffer.wrap(blob, 0, 4).getInt();
        if (len <= 0 || len > 64 || blob.length < 4 + len) {
            throw new IllegalArgumentException("Invalid host key");
        }
        return new String(blob, 4, len, StandardCharsets.US_ASCII);
    }

    /** Fingerprints are compared in constant time. */
    public static boolean sameFingerprint(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(a.trim().getBytes(StandardCharsets.UTF_8), b.trim().getBytes(StandardCharsets.UTF_8));
    }
}
