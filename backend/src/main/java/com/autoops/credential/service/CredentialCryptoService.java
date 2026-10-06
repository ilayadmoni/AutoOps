package com.autoops.credential.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

/** AES-256-GCM encryption for stored machine credentials. */
@Service
public class CredentialCryptoService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Set<String> PLACEHOLDERS = Set.of("replace-me", "change-me-in-production", "change-me", "changeme");
    private final SecretKey key;

    public CredentialCryptoService(@Value("${autoops.credentials.key}") String raw) {
        if (raw == null || raw.length() < 16 || PLACEHOLDERS.contains(raw)) {
            throw new IllegalStateException("CREDENTIAL_ENCRYPTION_KEY must be set to a random value of at least 16 characters");
        }
        try {
            key = new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)), "AES");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public Encrypted encrypt(String value) {
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return new Encrypted(Base64.getEncoder().encodeToString(c.doFinal(value.getBytes(StandardCharsets.UTF_8))),
                    Base64.getEncoder().encodeToString(iv));
        } catch (Exception e) {
            throw new IllegalStateException("Credential encryption failed");
        }
    }

    public String decrypt(String value, String iv) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.getDecoder().decode(iv)));
            return new String(c.doFinal(Base64.getDecoder().decode(value)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Credential decryption failed");
        }
    }

    public record Encrypted(String value, String iv) {
    }
}
