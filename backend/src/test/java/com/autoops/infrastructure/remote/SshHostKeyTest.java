package com.autoops.infrastructure.remote;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SshHostKeyTest {
    // ssh-keygen -lf for this key prints SHA256:XK4w77dg4W7GjcbLa8a6zFCOwMYxOlzcWSp8Blmd5T0
    private static final String ED25519 = "AAAAC3NzaC1lZDI1NTE5AAAAIKfYuFcR3oygTP1fAb4oVsv15iD7Ca6loRMC6xXhdqGr";

    @Test
    void fingerprintHashesRawKeyBytesLikeOpenSsh() {
        SshHostKey key = SshHostKey.fromBase64(ED25519);
        assertEquals("ssh-ed25519", key.algorithm());
        assertEquals("SHA256:XK4w77dg4W7GjcbLa8a6zFCOwMYxOlzcWSp8Blmd5T0", key.fingerprint());
    }

    @Test
    void fingerprintComparisonIsExact() {
        assertTrue(SshHostKey.sameFingerprint("SHA256:abc", " SHA256:abc "));
        assertFalse(SshHostKey.sameFingerprint("SHA256:abc", "SHA256:abd"));
        assertFalse(SshHostKey.sameFingerprint(null, "SHA256:abc"));
    }

    @Test
    void rejectsGarbage() {
        assertThrows(IllegalArgumentException.class, () -> SshHostKey.fromBlob(new byte[]{1, 2}));
    }
}
