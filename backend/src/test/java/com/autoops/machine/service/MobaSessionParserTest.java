package com.autoops.machine.service;

import com.autoops.common.error.ApiException;
import org.junit.jupiter.api.Test;
import java.nio.charset.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class MobaSessionParserTest {
    private final MobaSessionParser parser = new MobaSessionParser();
    private List<com.autoops.machine.dto.MachineImportDtos.Row> parse(String text) {
        return parser.parse(text.getBytes(StandardCharsets.UTF_8));
    }
    static String session(String name, String type, String host, String port, String user) {
        return name + "=#109#" + type + "%" + host + "%" + port + "%" + user + "%%-1%-1#MobaFont%10#0# #-1\n";
    }

    @Test void preservesNamesPortsUsersAndNestedFolderPaths() {
        var rows = parse("\uFEFF[Bookmarks]\r\nSubRep=Lab\r\nImgNum=41\r\n"
                + session("App node", "0", "app.example", "2222", "ops")
                + "[Bookmarks_1]\nSubRep=Lab\\Prod\\Apps\n"
                + session("API", "0", "[2001:db8::1]", "", "<default>"));
        assertEquals(2, rows.size());
        assertEquals("App node", rows.getFirst().name());
        assertEquals("ops", rows.getFirst().username());
        assertEquals(2222, rows.getFirst().sshPort());
        assertEquals("Lab/Prod/Apps", rows.get(1).folderPath());
        assertEquals("2001:db8::1", rows.get(1).hostname());
        assertEquals("", rows.get(1).username());
        assertEquals(22, rows.get(1).sshPort());
        assertNull(rows.get(1).skipReason());
    }

    @Test void skipsWindowsAndUnsupportedSessionsWithoutMistakingDarwin() {
        var rows = parse("[Bookmarks]\nSubRep=\n"
                + session("Remote", "4", "rdp", "3389", "Administrator")
                + session("Windows Server", "0", "ssh-win", "22", "admin")
                + session("Win11 lab", "0", "lab", "22", "admin")
                + session("Telnet", "1", "switch", "23", "")
                + session("darwin-builder", "0", "darwin", "22", "ops"));
        assertEquals(List.of("WINDOWS", "WINDOWS", "WINDOWS", "UNSUPPORTED"), rows.subList(0, 4).stream().map(r -> r.skipReason()).toList());
        assertNull(rows.get(4).skipReason());
    }

    @Test void invalidSessionsDoNotPreventValidRowsFromPreviewing() {
        var rows = parse("[Bookmarks]\nSubRep=\nBad=not a session\n"
                + session("Bad port", "0", "host", "65536", "ops")
                + session("Bad host", "0", "bad; touch /tmp/x", "22", "ops")
                + session("Good", "0", "good.example", "22", "ops")
                + "[Bookmarks_1]\nSubRep=Lab\\..\\Oops\n" + session("Bad folder", "0", "host", "22", "ops"));
        assertEquals("INVALID", rows.get(0).skipReason());
        assertEquals("INVALID", rows.get(1).skipReason());
        assertEquals("INVALID", rows.get(2).skipReason());
        assertNull(rows.get(3).skipReason());
        assertEquals("INVALID", rows.get(4).skipReason());
    }

    @Test void supportsWindows1252AndUtf16ExportsAndIgnoresOtherSections() {
        String text = "[Passwords]\nsecret=do not parse\n[Bookmarks]\nSubRep=\n"
                + session("Café €", "0", "host", "22", "ops");
        assertEquals("Café €", parser.parse(text.getBytes(Charset.forName("windows-1252"))).getFirst().name());
        assertEquals("Café €", parser.parse(text.getBytes(StandardCharsets.UTF_16)).getFirst().name());
        assertEquals(1, parse(text).size());
    }

    @Test void metadataNeverIncludesCommandsKeyPathsOrPasswords() {
        String[] fields = new String[35];
        Arrays.fill(fields, "");
        fields[0] = "0"; fields[1] = "host"; fields[2] = "22"; fields[3] = "ops";
        fields[7] = "SENSITIVE_STARTUP_COMMAND"; fields[8] = "gateway";
        fields[14] = "C:/SENSITIVE_KEY"; fields[19] = "2";
        var row = parse("[Bookmarks]\nSubRep=\nServer=#109#" + String.join("%", fields) + "#font#0#note#-1").getFirst();
        assertEquals(List.of("GATEWAY", "PRIVATE_KEY", "PROXY"), row.warnings());
        assertFalse(row.toString().contains("SENSITIVE"));
    }

    @Test void rejectsEmptyOversizedAndNonSessionFiles() {
        assertThrows(ApiException.class, () -> parser.parse(new byte[0]));
        assertThrows(ApiException.class, () -> parser.parse(new byte[MobaSessionParser.MAX_BYTES + 1]));
        assertThrows(ApiException.class, () -> parse("[Other]\nx=y"));
        assertThrows(ApiException.class, () -> parse("[Bookmarks]\nSubRep=\n" + session("VM", "0", "h", "22", "u").repeat(2001)));
    }

    @Test void providedExportCanBeVerifiedLocallyWithoutCheckingSensitiveDataIntoGit() throws Exception {
        String sample = System.getProperty("moba.sample");
        if (sample == null) return;
        var rows = parser.parse(Files.readAllBytes(Path.of(sample)));
        assertEquals(7, rows.size());
        assertTrue(rows.stream().anyMatch(r -> r.skipReason() == null));
    }
}
