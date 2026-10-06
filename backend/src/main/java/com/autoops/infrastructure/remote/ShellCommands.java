package com.autoops.infrastructure.remote;

/** Builders for the fixed, server-side commands AutoOps itself runs. User input only ever enters as quoted arguments. */
public final class ShellCommands {
    public static final String OS_RELEASE = "cat /etc/os-release";
    /** Verifies privilege escalation works with the credential's password (supplied on stdin, prompt suppressed). */
    public static final String SUDO_CHECK = "sudo -S -p '' -- true";

    private ShellCommands() {
    }

    /** POSIX single-quote escaping: the result is always one literal shell word. */
    public static String quote(String s) {
        return "'" + s.replace("'", "'\"'\"'") + "'";
    }

    /**
     * Wraps a command for privileged execution. The sudo password is supplied on stdin (never on a command line). The
     * wrapped shell immediately re-points its stdin to /dev/null, so even when sudo does not consume the password
     * (NOPASSWD rules) the command cannot read it.
     */
    public static String withSudo(String command) {
        return "sudo -S -p '' -- sh -c " + quote("exec </dev/null; " + command);
    }
}
