package com.autoops.infrastructure.remote;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OsInfoTest {
    @Test
    void detectsRhelFamily() {
        OsInfo rhel = OsInfo.parse("NAME=\"Red Hat Enterprise Linux\"\nID=\"rhel\"\nID_LIKE=\"fedora\"\nVERSION_ID=\"9.4\"\n");
        assertTrue(rhel.rhelFamily());
        assertEquals("9.4", rhel.versionId());
        OsInfo rocky = OsInfo.parse("ID=\"rocky\"\nID_LIKE=\"rhel centos fedora\"\n");
        assertTrue(rocky.rhelFamily());
        OsInfo ubuntu = OsInfo.parse("ID=ubuntu\nID_LIKE=debian\n");
        assertFalse(ubuntu.rhelFamily());
        assertFalse(OsInfo.parse("ID=fedora\n").rhelFamily());
    }
}
