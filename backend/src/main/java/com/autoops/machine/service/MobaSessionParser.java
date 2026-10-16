package com.autoops.machine.service;

import com.autoops.common.error.ApiException;
import com.autoops.machine.dto.MachineImportDtos.Row;
import org.springframework.stereotype.Component;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;

@Component
public class MobaSessionParser {
    public static final int MAX_BYTES = 2 * 1024 * 1024;

    public List<Row> parse(byte[] bytes) {
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw invalid("Choose a session file up to 2 MB");
        String content = decode(bytes).replace("\uFEFF", "");
        if (content.indexOf('\0') >= 0) throw invalid("Invalid session file encoding");
        List<Row> rows = new ArrayList<>();
        boolean bookmarks = false;
        String folder = "";
        for (String line : content.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith(";") || trimmed.startsWith("//")) continue;
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                bookmarks = trimmed.matches("(?i)\\[Bookmarks(?:_\\d+)?]");
                folder = "";
                continue;
            }
            if (!bookmarks) continue;
            int equals = line.indexOf('=');
            if (equals < 0) {
                rows.add(new Row(rows.size(), trimmed, "", 0, "", folder, "OTHER", "INVALID", List.of()));
            } else {
                String key = line.substring(0, equals).trim();
                String value = line.substring(equals + 1);
                if (key.equalsIgnoreCase("SubRep")) { folder = value.trim().replace('\\', '/'); continue; }
                if (key.equalsIgnoreCase("ImgNum")) continue;
                rows.add(MobaSessionFields.parse(rows.size(), key, value, folder));
            }
            if (rows.size() > 2000) throw invalid("A session file can contain at most 2000 sessions");
        }
        if (rows.isEmpty()) throw invalid("No MobaXterm sessions found in this file");
        return List.copyOf(rows);
    }

    private static String decode(byte[] bytes) {
        if (bytes.length >= 2 && ((bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xfe)
                || (bytes[0] == (byte) 0xfe && bytes[1] == (byte) 0xff))) return new String(bytes, StandardCharsets.UTF_16);
        try { return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString(); }
        catch (CharacterCodingException e) { return new String(bytes, Charset.forName("windows-1252")); }
    }

    private static ApiException invalid(String message) { return ApiException.badRequest("INVALID_SESSION_FILE", message); }
}
