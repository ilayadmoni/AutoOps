package com.autoops.infrastructure.remote;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OsInfoTest {
    @Test
    void parsesLinuxReleaseWithoutRequiringASpecificDistribution() {
        OsInfo info = OsInfo.parse("NAME=\"Ubuntu\"\nID=ubuntu\nID_LIKE=debian\nVERSION_ID=\"24.04\"\n");
        assertTrue(info.known());
        assertEquals("24.04", info.versionId());
        assertEquals(java.util.Optional.of(OsFamily.DEBIAN), info.family());
        assertEquals("Ubuntu 24.04", info.display());
    }

    @Test
    void acceptsAnUnknownLinuxDistribution() {
        OsInfo info = OsInfo.parse("ID=gentoo\nPRETTY_NAME='Gentoo Linux'\n");
        assertTrue(info.known());
        assertTrue(info.family().isEmpty());
        assertEquals("Gentoo Linux", info.display());
        assertFalse(OsInfo.parse("").known());
    }
}
