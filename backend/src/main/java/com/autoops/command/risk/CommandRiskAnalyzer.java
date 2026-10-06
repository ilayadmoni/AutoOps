package com.autoops.command.risk;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Server-side risk classification. The client never decides risk. Classification is conservative: the highest
 * matching level across the whole template wins.
 */
@Service
public class CommandRiskAnalyzer {
    public enum Risk { LOW, MEDIUM, HIGH }

    private static final String W = "(^|[\\s;&|(`])";
    private static final List<Pattern> HIGH = compile(
            W + "rm(\\s|$)", W + "rmdir\\s", W + "dd\\s", W + "mkfs", W + "fdisk\\s", W + "parted\\s", W + "wipefs\\s", W + "shred\\s",
            W + "(shutdown|reboot|poweroff|halt)(\\s|$)", W + "init\\s+[06]", W + "systemctl\\s+(reboot|poweroff|halt|kexec)",
            W + "(dnf|yum)\\s+(-\\S+\\s+)*(install|remove|erase|update|upgrade|downgrade|reinstall|autoremove|distro-sync|swap)",
            W + "rpm\\s+(-\\S*[eiUF]\\S*)", W + "(userdel|groupdel|passwd|chpasswd|visudo)(\\s|$)",
            W + "(killall|pkill)\\s", W + "kill\\s+-(9|KILL)", W + "iptables\\s+-(F|X|P)", W + "setenforce\\s+0",
            W + "crontab\\s+-r", W + "truncate\\s", W + "chmod\\s+(-R\\s+)?[0-7]*777", "(curl|wget)[^|]*\\|\\s*(ba)?sh",
            ">\\s*/dev/(sd|nvme|vd|xvd)", ":\\(\\)\\s*\\{", W + "(lvremove|vgremove|pvremove|mdadm)\\s", W + "firewall-cmd\\s+.*--panic-on");
    private static final List<Pattern> MEDIUM = compile(
            W + "systemctl\\s+(start|stop|restart|reload|enable|disable|mask|unmask|daemon-reload|try-restart)",
            W + "service\\s+\\S+\\s+(start|stop|restart|reload)", W + "(mv|cp|ln|mkdir|touch|tee|install)\\s", W + "(chmod|chown|chgrp)\\s",
            W + "sed\\s+(-\\S*\\s+)*-i", W + "kill\\s", W + "firewall-cmd\\s", W + "(useradd|usermod|groupadd|gpasswd)\\s",
            W + "(u?mount)\\s", W + "tar\\s+\\S*x", W + "unzip\\s", W + "(nmcli|hostnamectl|timedatectl|localectl)\\s+\\S*(set|mod|add|del|up|down)",
            ">>?\\s*[^&\\s]", W + "(semanage|setsebool|restorecon)\\s", W + "(dnf|yum)\\s+(-\\S+\\s+)*(clean|makecache|config-manager)",
            W + "(swapoff|swapon|sysctl\\s+-w)", W + "journalctl\\s+.*--vacuum", W + "(logrotate|subscription-manager)\\s");

    private static List<Pattern> compile(String... patterns) {
        return java.util.Arrays.stream(patterns).map(Pattern::compile).toList();
    }

    public Risk analyze(String command) {
        String x = command == null ? "" : command.toLowerCase(Locale.ROOT);
        if (HIGH.stream().anyMatch(p -> p.matcher(x).find())) {
            return Risk.HIGH;
        }
        if (MEDIUM.stream().anyMatch(p -> p.matcher(x).find())) {
            return Risk.MEDIUM;
        }
        return Risk.LOW;
    }

    /** Privileged execution never lowers risk and raises LOW to MEDIUM. */
    public static Risk withSudo(Risk base, boolean sudo) {
        return sudo && base == Risk.LOW ? Risk.MEDIUM : base;
    }

    public static Risk max(Risk a, Risk b) {
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
