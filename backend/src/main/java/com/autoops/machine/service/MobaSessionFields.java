package com.autoops.machine.service;

import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.dto.MachineImportDtos.Row;
import java.net.InetAddress;
import java.util.*;
import java.util.regex.Pattern;

/** Only connection metadata is read. Startup commands, macros and local paths are never executed. */
final class MobaSessionFields {
    private static final Pattern WINDOWS = Pattern.compile(
            "(?i)(?:^|[^a-z0-9])(?:windows|win(?:xp|7|8|10|11|20\\d\\d)?)(?:$|[^a-z0-9])");
    private MobaSessionFields() {}

    static Row parse(int index, String name, String value, String folder) {
        String[] groups = value.stripLeading().split("#", -1);
        String[] fields = groups.length > 2 ? groups[2].split("%", -1) : new String[0];
        String type = field(fields, 0);
        String host = field(fields, 1).trim();
        if (host.startsWith("[") && host.endsWith("]")) host = host.substring(1, host.length() - 1);
        host = host.replaceFirst("\\.$", "");
        String user = field(fields, 3).trim();
        if (user.equals("<default>")) user = "";
        int port;
        try { port = field(fields, 2).isBlank() ? 22 : Integer.parseInt(field(fields, 2)); }
        catch (NumberFormatException e) { port = 0; }
        String protocol = type.equals("0") ? "SSH" : type.equals("4") ? "RDP" : "OTHER";
        String reason = null;
        if (type.equals("4")) reason = "WINDOWS";
        else if (!type.equals("0")) reason = fields.length == 0 ? "INVALID" : "UNSUPPORTED";
        else if (WINDOWS.matcher(name + " " + host + " " + folder + " " + field(groups, 5)).find()) reason = "WINDOWS";
        else if (fields.length < 4 || name.isBlank() || name.length() > 150 || !validHost(host)
                || port < 1 || port > 65535 || !validFolder(folder) || user.length() > 150) reason = "INVALID";
        List<String> warnings = new ArrayList<>();
        if (!field(fields, 8).isBlank()) warnings.add("GATEWAY");
        if (!field(fields, 14).isBlank()) warnings.add("PRIVATE_KEY");
        if (!field(fields, 19).isBlank() && !field(fields, 19).equals("0")) warnings.add("PROXY");
        return new Row(index, name, host, port, user, folder, protocol, reason, List.copyOf(warnings));
    }

    static String field(String[] fields, int index) { return fields.length > index ? fields[index] : ""; }

    static boolean validFolder(String folder) {
        if (folder.length() > 1000 || folder.chars().anyMatch(Character::isISOControl)) return false;
        if (folder.isEmpty()) return true;
        String[] parts = folder.split("/", -1);
        return parts.length <= 32 && Arrays.stream(parts).allMatch(p -> !p.isBlank() && p.length() <= 150
                && !p.equals(".") && !p.equals(".."));
    }

    private static boolean validHost(String host) {
        if (host.contains(":")) {
            try { return host.matches("[0-9a-fA-F:.]+") && InetAddress.getByName(host).getAddress().length == 16; }
            catch (Exception e) { return false; }
        }
        return !host.isEmpty() && host.matches(MachineDtos.HOST_PATTERN);
    }

    static String endpoint(String host, int port) {
        String normalized = host.toLowerCase(Locale.ROOT).replaceFirst("\\.$", "");
        if (normalized.contains(":")) {
            try { normalized = InetAddress.getByName(normalized).getHostAddress(); }
            catch (Exception ignored) { /* Invalid legacy endpoints are still compared as text. */ }
        }
        return normalized + "|" + port;
    }
}
