package com.autoops.infrastructure.remote;

import com.jcraft.jsch.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

/**
 * JSch-based SSH/SFTP client. Strict host key checking is always on and every session is bound to a repository that
 * contains only the machine's persisted trusted key, so a changed key aborts the connection before authentication.
 */
@Component
public class SshRemoteClient implements RemoteClient {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SshRemoteClient.class);
    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private final int maxOutputBytes;

    public SshRemoteClient(@Value("${autoops.execution.max-output-bytes:65536}") int maxOutputBytes) {
        this.maxOutputBytes = maxOutputBytes;
    }

    @Override
    public SshHostKey discoverHostKey(String host, int port) {
        AtomicReference<byte[]> captured = new AtomicReference<>();
        Session session = null;
        try {
            JSch jsch = new JSch();
            session = jsch.getSession("autoops-hostkey-probe", host, port);
            session.setHostKeyRepository(new CapturingRepository(captured));
            session.setConfig("StrictHostKeyChecking", "yes");
            session.setConfig("PreferredAuthentications", "none");
            session.connect(CONNECT_TIMEOUT_MS);
        } catch (JSchException e) {
            if (captured.get() == null) {
                throw classifyConnect(e, null);
            }
        } finally {
            if (session != null) {
                session.disconnect();
            }
        }
        if (captured.get() == null) {
            throw new RemoteException(RemoteException.Kind.CONNECTION_FAILED, "Server did not present a host key");
        }
        return SshHostKey.fromBlob(captured.get());
    }

    @Override
    public RemoteSession open(RemoteTarget target) {
        PinnedRepository repo = new PinnedRepository(target.trustedKey());
        Session session = null;
        try {
            JSch jsch = new JSch();
            session = jsch.getSession(target.username(), target.host(), target.port());
            session.setHostKeyRepository(repo);
            session.setConfig("StrictHostKeyChecking", "yes");
            session.setConfig("server_host_key", hostKeyAlgorithms(target.trustedKey().algorithm()));
            session.setConfig("PreferredAuthentications", "password,keyboard-interactive");
            session.setConfig("MaxAuthTries", "2");
            session.setPassword(target.password());
            session.setUserInfo(new PasswordUserInfo(target.password()));
            session.setServerAliveInterval(15_000);
            session.connect(CONNECT_TIMEOUT_MS);
            return new JschSession(session, maxOutputBytes);
        } catch (JSchException e) {
            if (session != null) {
                session.disconnect();
            }
            if (repo.mismatch != null) {
                throw new RemoteException(RemoteException.Kind.HOST_KEY_MISMATCH,
                        "SSH host key mismatch: the server presented a different key than the trusted one", repo.mismatch);
            }
            throw classifyConnect(e, repo);
        }
    }

    /** Restricts negotiation to the trusted key's type so the server presents the same key that was trusted. */
    static String hostKeyAlgorithms(String keyType) {
        return switch (keyType) {
            case "ssh-rsa" -> "rsa-sha2-512,rsa-sha2-256,ssh-rsa";
            default -> keyType;
        };
    }

    private static RemoteException classifyConnect(JSchException e, PinnedRepository repo) {
        String msg = e.getMessage() == null ? "" : e.getMessage();
        Throwable cause = e.getCause();
        if (e instanceof JSchChangedHostKeyException) {
            return new RemoteException(RemoteException.Kind.HOST_KEY_MISMATCH, "SSH host key mismatch", repo == null ? null : repo.mismatch);
        }
        if (msg.contains("Auth fail") || msg.contains("Auth cancel") || msg.contains("Too many authentication failures")) {
            return new RemoteException(RemoteException.Kind.AUTHENTICATION_FAILED, "SSH authentication failed");
        }
        if (cause instanceof UnknownHostException) {
            return new RemoteException(RemoteException.Kind.CONNECTION_FAILED, "Unknown host");
        }
        if (cause instanceof ConnectException) {
            return new RemoteException(RemoteException.Kind.CONNECTION_FAILED, "Connection refused");
        }
        if (cause instanceof SocketTimeoutException || msg.toLowerCase().contains("timeout") || msg.toLowerCase().contains("timed out")) {
            return new RemoteException(RemoteException.Kind.TIMEOUT, "Connection timed out");
        }
        if (e instanceof JSchAlgoNegoFailException) {
            return new RemoteException(RemoteException.Kind.CONNECTION_FAILED, "SSH algorithm negotiation failed (the server no longer offers the trusted key type)");
        }
        log.info("Unclassified SSH connection failure: {}: {}", e.getClass().getSimpleName(), msg);
        return new RemoteException(RemoteException.Kind.CONNECTION_FAILED, "SSH connection failed");
    }

    /** Records the presented key and rejects it; used only for discovery (no authentication follows). */
    private static final class CapturingRepository extends EmptyRepository {
        private final AtomicReference<byte[]> captured;

        CapturingRepository(AtomicReference<byte[]> captured) {
            this.captured = captured;
        }

        @Override
        public int check(String host, byte[] key) {
            captured.set(key.clone());
            return NOT_INCLUDED;
        }
    }

    /** Accepts exactly one key (compared in constant time); anything else is reported as CHANGED. */
    private static final class PinnedRepository extends EmptyRepository {
        private final byte[] trusted;
        volatile String mismatch;

        PinnedRepository(SshHostKey trusted) {
            this.trusted = trusted.blob();
        }

        @Override
        public int check(String host, byte[] key) {
            if (MessageDigest.isEqual(trusted, key)) {
                return OK;
            }
            mismatch = SshHostKey.fingerprint(key);
            return CHANGED;
        }
    }

    private abstract static class EmptyRepository implements HostKeyRepository {
        @Override
        public void add(HostKey hostkey, UserInfo ui) {
            // Never persist keys implicitly.
        }

        @Override
        public void remove(String host, String type) {
        }

        @Override
        public void remove(String host, String type, byte[] key) {
        }

        @Override
        public String getKnownHostsRepositoryID() {
            return "autoops-pinned";
        }

        @Override
        public HostKey[] getHostKey() {
            return new HostKey[0];
        }

        @Override
        public HostKey[] getHostKey(String host, String type) {
            return new HostKey[0];
        }
    }

    /** Supplies the password for keyboard-interactive authentication and refuses every other prompt. */
    private record PasswordUserInfo(String password) implements UserInfo, UIKeyboardInteractive {
        public String getPassphrase() { return null; }
        public String getPassword() { return password; }
        public boolean promptPassword(String message) { return true; }
        public boolean promptPassphrase(String message) { return false; }
        public boolean promptYesNo(String message) { return false; }
        public void showMessage(String message) { }

        public String[] promptKeyboardInteractive(String destination, String name, String instruction, String[] prompt, boolean[] echo) {
            if (prompt.length == 1 && !echo[0]) {
                return new String[]{password};
            }
            return null;
        }
    }

    private static final class JschSession implements RemoteSession {
        private final Session session;
        private final int maxOutputBytes;

        JschSession(Session session, int maxOutputBytes) {
            this.session = session;
            this.maxOutputBytes = maxOutputBytes;
        }

        @Override
        public ExecResult exec(String command, String stdin, int timeoutSeconds, BooleanSupplier cancelled, OutputListener listener) {
            ChannelExec channel = null;
            try {
                channel = (ChannelExec) session.openChannel("exec");
                channel.setCommand(command);
                channel.setPty(false);
                InputStream out = channel.getInputStream();
                InputStream err = channel.getErrStream();
                OutputStream in = channel.getOutputStream();
                channel.connect(CONNECT_TIMEOUT_MS);
                if (stdin != null) {
                    in.write(stdin.getBytes(StandardCharsets.UTF_8));
                    in.write('\n');
                    in.flush();
                }
                in.close();
                BoundedOutput stdout = new BoundedOutput(maxOutputBytes);
                BoundedOutput stderr = new BoundedOutput(maxOutputBytes);
                long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
                byte[] buf = new byte[8192];
                boolean timedOut = false;
                boolean wasCancelled = false;
                while (true) {
                    boolean read = drain(out, stdout, buf, listener, "stdout") | drain(err, stderr, buf, listener, "stderr");
                    if (channel.isClosed() && out.available() == 0 && err.available() == 0) {
                        break;
                    }
                    if (System.currentTimeMillis() > deadline) {
                        timedOut = true;
                        break;
                    }
                    if (cancelled != null && cancelled.getAsBoolean()) {
                        wasCancelled = true;
                        break;
                    }
                    if (!read) {
                        Thread.sleep(25);
                    }
                }
                int code = timedOut || wasCancelled ? -1 : channel.getExitStatus();
                return new ExecResult(code, stdout.text(), stderr.text(), timedOut, wasCancelled);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return new ExecResult(-1, "", "Interrupted", false, true);
            } catch (JSchException | IOException e) {
                throw new RemoteException(RemoteException.Kind.CONNECTION_FAILED, "Remote command channel failed");
            } finally {
                if (channel != null) {
                    channel.disconnect();
                }
            }
        }

        private static boolean drain(InputStream s, BoundedOutput target, byte[] buf, OutputListener listener, String name) throws IOException {
            boolean any = false;
            while (s.available() > 0) {
                int n = s.read(buf, 0, buf.length);
                if (n < 0) {
                    break;
                }
                target.write(buf, 0, n);
                if (listener != null) {
                    listener.onOutput(name, new String(buf, 0, n, StandardCharsets.UTF_8));
                }
                any = true;
            }
            return any;
        }

        @Override
        public void upload(InputStream data, long size, String remotePath, int timeoutSeconds) {
            ChannelSftp sftp = null;
            try {
                sftp = (ChannelSftp) session.openChannel("sftp");
                sftp.connect(CONNECT_TIMEOUT_MS);
                long[] transferred = {0};
                long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
                sftp.put(data, remotePath, new SftpProgressMonitor() {
                    public void init(int op, String src, String dest, long max) { }

                    public boolean count(long count) {
                        transferred[0] += count;
                        return System.currentTimeMillis() < deadline;
                    }

                    public void end() { }
                }, ChannelSftp.OVERWRITE);
                if (System.currentTimeMillis() >= deadline) {
                    throw new RemoteException(RemoteException.Kind.TIMEOUT, "File transfer timed out");
                }
                if (size >= 0 && transferred[0] != size) {
                    throw new RemoteException(RemoteException.Kind.TRANSFER_FAILED,
                            "File transfer incomplete: " + transferred[0] + " of " + size + " bytes sent");
                }
            } catch (SftpException e) {
                throw new RemoteException(RemoteException.Kind.TRANSFER_FAILED, "SFTP transfer failed: " + sftpReason(e));
            } catch (JSchException e) {
                throw new RemoteException(RemoteException.Kind.CONNECTION_FAILED, "SFTP channel failed");
            } finally {
                if (sftp != null) {
                    sftp.disconnect();
                }
            }
        }

        private static String sftpReason(SftpException e) {
            return switch (e.id) {
                case ChannelSftp.SSH_FX_PERMISSION_DENIED -> "permission denied";
                case ChannelSftp.SSH_FX_NO_SUCH_FILE -> "no such file or directory";
                case ChannelSftp.SSH_FX_FAILURE -> "remote failure";
                default -> "error " + e.id;
            };
        }

        @Override
        public void close() {
            session.disconnect();
        }
    }
}
