package com.autoops.infrastructure.remote;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** Keeps the head and the tail of a stream so runaway output cannot exhaust memory or the database. */
final class BoundedOutput {
    private final int headLimit;
    private final int tailLimit;
    private final ByteArrayOutputStream head = new ByteArrayOutputStream();
    private final byte[] tail;
    private int tailStart;
    private int tailSize;
    private long total;

    BoundedOutput(int maxBytes) {
        this.headLimit = maxBytes / 4;
        this.tailLimit = maxBytes - headLimit;
        this.tail = new byte[Math.max(tailLimit, 1)];
    }

    void write(byte[] buf, int off, int len) {
        for (int i = 0; i < len; i++) {
            byte b = buf[off + i];
            total++;
            if (head.size() < headLimit) {
                head.write(b);
            } else if (tailSize < tailLimit) {
                tail[(tailStart + tailSize) % tail.length] = b;
                tailSize++;
            } else {
                tail[tailStart] = b;
                tailStart = (tailStart + 1) % tail.length;
            }
        }
    }

    String text() {
        byte[] t = new byte[tailSize];
        for (int i = 0; i < tailSize; i++) {
            t[i] = tail[(tailStart + i) % tail.length];
        }
        String h = head.toString(StandardCharsets.UTF_8);
        String tt = new String(t, StandardCharsets.UTF_8);
        long kept = (long) head.size() + tailSize;
        if (total > kept) {
            return h + "\n…[" + (total - kept) + " bytes of output truncated]…\n" + tt;
        }
        return h + tt;
    }
}
