package com.autoops.infrastructure.remote;

import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class OsFamilyTest {
    @Test
    void machineFamilyFromOsRelease() {
        assertEquals(Optional.of(OsFamily.RHEL), OsInfo.parse("ID=\"centos\"\nID_LIKE=\"rhel fedora\"\n").family());
        assertEquals(Optional.of(OsFamily.RHEL), OsInfo.parse("ID=fedora\n").family());
        assertEquals(Optional.of(OsFamily.DEBIAN), OsInfo.parse("ID=ubuntu\nID_LIKE=debian\n").family());
        assertEquals(Optional.of(OsFamily.SUSE), OsInfo.parse("ID=\"opensuse-leap\"\nID_LIKE=\"suse opensuse\"\n").family());
        assertEquals(Optional.of(OsFamily.DEBIAN), OsInfo.parse("ID=elementary\nID_LIKE=\"ubuntu debian\"\n").family());
        assertTrue(OsInfo.parse("ID=gentoo\n").family().isEmpty());
    }

    @Test
    void templateFamilyFromTool() {
        assertEquals(EnumSet.of(OsFamily.RHEL), OsFamily.ofTemplate("dnf install -y {{package}}"));
        assertEquals(EnumSet.of(OsFamily.DEBIAN), OsFamily.ofTemplate("  apt-get update"));
        assertEquals(EnumSet.of(OsFamily.LINUX), OsFamily.ofTemplate("systemctl restart {{service}}"));
        assertEquals(EnumSet.of(OsFamily.LINUX), OsFamily.ofTemplate("rpmbuild -ba x.spec"));
    }

    @Test
    void storedValuesAndCompatibility() {
        assertEquals(EnumSet.of(OsFamily.LINUX), OsFamily.parseStored(null));
        assertEquals(EnumSet.of(OsFamily.LINUX), OsFamily.parseStored("legacy"));
        assertEquals(EnumSet.of(OsFamily.RHEL, OsFamily.DEBIAN), OsFamily.parseStored("RHEL,debian"));
        assertEquals("DEBIAN,RHEL", OsFamily.format(EnumSet.of(OsFamily.RHEL, OsFamily.DEBIAN)));
        assertTrue(OsFamily.compatible(EnumSet.of(OsFamily.LINUX), Optional.empty()));
        assertTrue(OsFamily.compatible(EnumSet.of(OsFamily.RHEL), Optional.of(OsFamily.RHEL)));
        assertFalse(OsFamily.compatible(EnumSet.of(OsFamily.RHEL), Optional.of(OsFamily.DEBIAN)));
        assertFalse(OsFamily.compatible(EnumSet.of(OsFamily.RHEL), Optional.empty()));
    }
}
