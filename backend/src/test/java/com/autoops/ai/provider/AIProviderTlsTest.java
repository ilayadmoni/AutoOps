package com.autoops.ai.provider;

import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class AIProviderTlsTest {
    @TempDir static Path directory;
    private static Path certificate;
    private static SSLContext serverContext;

    @BeforeAll
    static void createCertificate() throws Exception {
        Path storePath = directory.resolve("server.p12");
        String keytool = Path.of(System.getProperty("java.home"), "bin",
                System.getProperty("os.name").startsWith("Windows") ? "keytool.exe" : "keytool").toString();
        Path output = directory.resolve("keytool.log");
        Process process = new ProcessBuilder(keytool, "-genkeypair", "-alias", "server", "-keyalg", "RSA",
                "-keystore", storePath.toString(), "-storetype", "PKCS12", "-storepass", "test-password",
                "-dname", "CN=localhost", "-ext", "SAN=dns:localhost", "-validity", "2", "-noprompt")
                .redirectErrorStream(true).redirectOutput(output.toFile()).start();
        assertTrue(process.waitFor(30, TimeUnit.SECONDS), "keytool timed out");
        assertEquals(0, process.exitValue(), () -> "keytool failed; see " + output);
        KeyStore store = KeyStore.getInstance("PKCS12");
        try (var input = Files.newInputStream(storePath)) {
            store.load(input, "test-password".toCharArray());
        }
        certificate = directory.resolve("provider-ca.pem");
        String encoded = java.util.Base64.getMimeEncoder(64, new byte[]{'\n'})
                .encodeToString(store.getCertificate("server").getEncoded());
        Files.writeString(certificate, "-----BEGIN CERTIFICATE-----\n" + encoded + "\n-----END CERTIFICATE-----\n");
        KeyManagerFactory keys = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        keys.init(store, "test-password".toCharArray());
        serverContext = SSLContext.getInstance("TLS");
        serverContext.init(keys.getKeyManagers(), null, null);
    }

    @Test
    void customCertificateEnablesTlsButStillChecksHostname() throws Exception {
        HttpsServer server = HttpsServer.create(new InetSocketAddress("localhost", 0), 0);
        server.setHttpsConfigurator(new HttpsConfigurator(serverContext));
        server.createContext("/", exchange -> {
            byte[] body = "ok".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (var response = exchange.getResponseBody()) { response.write(body); }
        });
        server.start();
        try (HttpClient defaults = HttpClient.newHttpClient(); HttpClient custom = client(certificate.toString())) {
            URI uri = URI.create("https://localhost:" + server.getAddress().getPort());
            var request = HttpRequest.newBuilder(uri).GET().build();
            assertThrows(SSLHandshakeException.class, () -> defaults.send(request, HttpResponse.BodyHandlers.ofString()));
            assertEquals("ok", custom.send(request, HttpResponse.BodyHandlers.ofString()).body());
            var wrongHost = HttpRequest.newBuilder(URI.create("https://127.0.0.1:" + server.getAddress().getPort())).GET().build();
            assertThrows(SSLHandshakeException.class, () -> custom.send(wrongHost, HttpResponse.BodyHandlers.ofString()));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void customBundleRetainsDefaultTrustAnchors() throws Exception {
        Path bundle = directory.resolve("bundle.pem");
        Files.writeString(bundle, Files.readString(certificate).repeat(2));
        TrustManagerFactory defaults = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        defaults.init((KeyStore) null);
        var expected = Arrays.stream(defaults.getTrustManagers()).filter(X509TrustManager.class::isInstance)
                .map(X509TrustManager.class::cast).flatMap(m -> Arrays.stream(m.getAcceptedIssuers())).findFirst().orElseThrow();
        var manager = (X509TrustManager) AIProviderTls.trustedCertificates(bundle.toString())[0];
        assertTrue(Arrays.asList(manager.getAcceptedIssuers()).contains(expected));
        try (var input = Files.newInputStream(certificate)) {
            var custom = CertificateFactory.getInstance("X.509").generateCertificate(input);
            assertTrue(Arrays.asList(manager.getAcceptedIssuers()).contains(custom));
        }
        Path der = directory.resolve("default-ca.der");
        Files.write(der, expected.getEncoded());
        try (HttpClient ignored = client(der.toString())) {
            assertNotNull(ignored.sslContext());
        }
    }

    @Test
    void rejectsMissingEmptyAndInvalidCertificates() throws Exception {
        assertThrows(IllegalStateException.class, () -> client(directory.resolve("missing.pem").toString()));
        Path invalid = directory.resolve("invalid.pem");
        Files.writeString(invalid, "not a certificate");
        assertThrows(IllegalStateException.class, () -> client(invalid.toString()));
        Files.writeString(invalid, "");
        assertThrows(IllegalStateException.class, () -> client(invalid.toString()));
        try (HttpClient defaults = client("")) {
            assertSame(SSLContext.getDefault(), defaults.sslContext());
        }
    }

    private static HttpClient client(String path) {
        var builder = HttpClient.newBuilder();
        AIProviderTls.configure(builder, true, path);
        return builder.build();
    }
}
