package com.autoops.embedding;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.CRC32;

/**
 * Local, deterministic fallback embedding: signed feature hashing of word unigrams, word bigrams and character
 * trigrams, L2-normalized. It captures lexical similarity (not semantics) and needs no external service.
 */
public class HashEmbeddingProvider implements EmbeddingProvider {
    public float[] embed(String text) {
        float[] v = new float[DIMENSIONS];
        String t = text == null ? "" : text.toLowerCase(Locale.ROOT);
        String[] words = t.split("[^a-z0-9]+");
        String prev = null;
        for (String w : words) {
            if (w.isEmpty()) {
                continue;
            }
            add(v, "w:" + w, 1.0f);
            if (prev != null) {
                add(v, "b:" + prev + "_" + w, 0.5f);
            }
            String padded = " " + w + " ";
            for (int i = 0; i + 3 <= padded.length(); i++) {
                add(v, "c:" + padded.substring(i, i + 3), 0.35f);
            }
            prev = w;
        }
        double norm = 0;
        for (float x : v) {
            norm += x * x;
        }
        if (norm > 0) {
            float n = (float) Math.sqrt(norm);
            for (int i = 0; i < v.length; i++) {
                v[i] /= n;
            }
        } else {
            v[0] = 1f;
        }
        return v;
    }

    private static void add(float[] v, String feature, float weight) {
        CRC32 crc = new CRC32();
        crc.update(feature.getBytes(StandardCharsets.UTF_8));
        long h = crc.getValue();
        int idx = (int) (h % DIMENSIONS);
        v[idx] += ((h >>> 20) & 1) == 0 ? weight : -weight;
    }

    public String provider() {
        return "LOCAL";
    }

    public String model() {
        return "hash-lexical-384";
    }
}
