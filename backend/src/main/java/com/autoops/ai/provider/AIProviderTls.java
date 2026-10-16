package com.autoops.ai.provider;

import org.slf4j.LoggerFactory;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;

/** TLS configuration scoped to the AI client; custom certificates supplement JVM trust anchors. */
final class AIProviderTls {
    private AIProviderTls() { }

    static void configure(HttpClient.Builder http, boolean verify, String certPath) {
        if (verify && (certPath == null || certPath.isBlank())) {
            return;
        }
        try {
            TrustManager[] managers;
            if (!verify) {
                LoggerFactory.getLogger(AIProviderTls.class).warn(
                        "AI_SSL_VERIFY=false: TLS certificates of the AI provider are NOT verified. "
                                + "Prefer AI_SSL_CERT_PATH with verification enabled.");
                managers = new TrustManager[]{new X509TrustManager() {
                    public void checkClientTrusted(X509Certificate[] chain, String authType) { }
                    public void checkServerTrusted(X509Certificate[] chain, String authType) { }
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                }};
            } else {
                managers = trustedCertificates(certPath);
            }
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, managers, null);
            http.sslContext(context);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot configure AI provider TLS. Check AI_SSL_CERT_PATH: " + certPath, e);
        }
    }

    static TrustManager[] trustedCertificates(String certPath) throws Exception {
        TrustManagerFactory defaults = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        defaults.init((KeyStore) null);
        KeyStore store = KeyStore.getInstance(KeyStore.getDefaultType());
        store.load(null, null);
        int index = 0;
        for (TrustManager manager : defaults.getTrustManagers()) {
            if (manager instanceof X509TrustManager x509) {
                for (X509Certificate cert : x509.getAcceptedIssuers()) {
                    store.setCertificateEntry("default-" + index++, cert);
                }
            }
        }
        try (var input = Files.newInputStream(Path.of(certPath))) {
            var certificates = CertificateFactory.getInstance("X.509").generateCertificates(input);
            if (certificates.isEmpty()) {
                throw new IllegalArgumentException("Certificate file contains no X.509 certificates");
            }
            for (var cert : certificates) {
                store.setCertificateEntry("custom-" + index++, cert);
            }
        }
        TrustManagerFactory factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        factory.init(store);
        return factory.getTrustManagers();
    }
}
