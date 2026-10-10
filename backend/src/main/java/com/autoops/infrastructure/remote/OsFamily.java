package com.autoops.infrastructure.remote;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Linux distribution families. A command's supported OS is a set of families; {@link #LINUX} means any Linux.
 * Families are what matter for compatibility (package manager, firewall and security tooling), not exact distros.
 */
public enum OsFamily {
    LINUX, RHEL, DEBIAN, SUSE, ARCH, ALPINE;

    private static final Map<String, OsFamily> IDS = Map.ofEntries(
            Map.entry("rhel", RHEL), Map.entry("centos", RHEL), Map.entry("rocky", RHEL), Map.entry("almalinux", RHEL),
            Map.entry("ol", RHEL), Map.entry("fedora", RHEL), Map.entry("amzn", RHEL),
            Map.entry("debian", DEBIAN), Map.entry("ubuntu", DEBIAN), Map.entry("linuxmint", DEBIAN), Map.entry("raspbian", DEBIAN),
            Map.entry("pop", DEBIAN), Map.entry("kali", DEBIAN),
            Map.entry("suse", SUSE), Map.entry("sles", SUSE), Map.entry("opensuse", SUSE), Map.entry("opensuse-leap", SUSE),
            Map.entry("opensuse-tumbleweed", SUSE),
            Map.entry("arch", ARCH), Map.entry("manjaro", ARCH), Map.entry("alpine", ALPINE));
    /** Free-text OS names in datasets, matched as whole words. Order matters: specific families before plain "linux". */
    private static final List<Map.Entry<Pattern, OsFamily>> NAMES = List.of(
            Map.entry(word("rhel\\d*|red ?hat|redhat|centos|rocky|alma(linux)?|oracle linux|el\\d+|fedora|amazon linux"), RHEL),
            Map.entry(word("debian|ubuntu|mint|raspbian|kali"), DEBIAN),
            Map.entry(word("suse|sles|opensuse"), SUSE),
            Map.entry(word("arch|manjaro"), ARCH),
            Map.entry(word("alpine"), ALPINE),
            Map.entry(word("linux|gnu|any|all|unix|posix"), LINUX));
    private static final Pattern NOT_LINUX = word("windows|macos|darwin|osx|mac os|freebsd|openbsd|netbsd|bsd|solaris|aix|hp-ux|android|ios");

    /** Tools that exist only in one family; a template starting with one of them needs that family. */
    private static final Map<String, OsFamily> FAMILY_TOOLS = Map.ofEntries(
            Map.entry("dnf", RHEL), Map.entry("yum", RHEL), Map.entry("rpm", RHEL), Map.entry("firewall-cmd", RHEL),
            Map.entry("getenforce", RHEL), Map.entry("setenforce", RHEL), Map.entry("sestatus", RHEL),
            Map.entry("semanage", RHEL), Map.entry("restorecon", RHEL), Map.entry("subscription-manager", RHEL),
            Map.entry("apt", DEBIAN), Map.entry("apt-get", DEBIAN), Map.entry("apt-cache", DEBIAN), Map.entry("dpkg", DEBIAN),
            Map.entry("ufw", DEBIAN), Map.entry("zypper", SUSE), Map.entry("pacman", ARCH), Map.entry("apk", ALPINE));

    private static Pattern word(String alternatives) {
        return Pattern.compile("\\b(" + alternatives + ")\\b");
    }

    /** Families a command template needs, judged by its first word: LINUX unless it is a family-specific tool. */
    public static Set<OsFamily> ofTemplate(String template) {
        String first = template == null ? "" : template.strip().split("\\s+", 2)[0];
        OsFamily family = FAMILY_TOOLS.get(first);
        return EnumSet.of(family == null ? LINUX : family);
    }

    /** Family of a machine from /etc/os-release ID and ID_LIKE; empty for a distro outside the known families. */
    public static Optional<OsFamily> ofRelease(String id, String idLike) {
        List<String> candidates = new ArrayList<>();
        candidates.add(id == null ? "" : id.toLowerCase(Locale.ROOT).trim());
        if (idLike != null) {
            candidates.addAll(Arrays.asList(idLike.toLowerCase(Locale.ROOT).trim().split("\\s+")));
        }
        return candidates.stream().map(IDS::get).filter(Objects::nonNull).findFirst();
    }

    /**
     * Families named by a dataset's free-text OS value ("rhel, centos", "ubuntu", "linux"). Empty when the value only
     * names non-Linux systems; blank or unrecognized Linux values mean any Linux.
     */
    public static Optional<Set<OsFamily>> ofDatasetValue(String value) {
        String v = value == null ? "" : value.toLowerCase(Locale.ROOT);
        Set<OsFamily> found = EnumSet.noneOf(OsFamily.class);
        boolean nonLinux = false;
        for (String part : v.split("[,;/|]")) {
            String p = part.strip();
            if (p.isEmpty()) {
                continue;
            }
            OsFamily family = NAMES.stream().filter(e -> e.getKey().matcher(p).find()).map(Map.Entry::getValue).findFirst().orElse(null);
            if (family != null) {
                found.add(family);
            } else if (NOT_LINUX.matcher(p).find()) {
                nonLinux = true;
            } else {
                found.add(LINUX);
            }
        }
        if (found.isEmpty()) {
            return nonLinux ? Optional.empty() : Optional.of(EnumSet.of(LINUX));
        }
        return Optional.of(found.contains(LINUX) ? EnumSet.of(LINUX) : found);
    }

    /** Parses a stored supported-OS value ("LINUX", "RHEL,DEBIAN"); blank, legacy or unknown values mean any Linux. */
    public static Set<OsFamily> parseStored(String stored) {
        Set<OsFamily> out = EnumSet.noneOf(OsFamily.class);
        if (stored != null) {
            for (String part : stored.split(",")) {
                try {
                    out.add(valueOf(part.strip().toUpperCase(Locale.ROOT)));
                } catch (IllegalArgumentException ignored) {
                    // Unknown token: ignore it.
                }
            }
        }
        return out.isEmpty() || out.contains(LINUX) ? EnumSet.of(LINUX) : out;
    }

    public static String format(Set<OsFamily> families) {
        return families.stream().map(Enum::name).sorted().reduce((a, b) -> a + "," + b).orElse(LINUX.name());
    }

    /** Whether a command for {@code supported} may run on a machine of {@code machine} (empty = unknown family). */
    public static boolean compatible(Set<OsFamily> supported, Optional<OsFamily> machine) {
        return supported.contains(LINUX) || machine.map(supported::contains).orElse(false);
    }
}
