package com.autoops.embedding;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/** Remote embeddings via an OpenAI-compatible /embeddings endpoint, requesting exactly 384 dimensions. */
public class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
    private final RestClient client;
    private final String model;

    public OpenAiCompatibleEmbeddingProvider(String baseUrl, String apiKey, String model) {
        this.model = model;
        JdkClientHttpRequestFactory f = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(10)).build());
        f.setReadTimeout(Duration.ofSeconds(60));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(new BufferingClientHttpRequestFactory(f))
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey).build();
    }

    @SuppressWarnings("unchecked")
    public float[] embed(String text) {
        Map<String, Object> r = client.post().uri("/embeddings").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("model", model, "input", text, "dimensions", DIMENSIONS)).retrieve().body(Map.class);
        List<Number> values = (List<Number>) ((Map<String, Object>) ((List<Object>) r.get("data")).get(0)).get("embedding");
        if (values.size() != DIMENSIONS) {
            throw new IllegalStateException("Embedding provider returned " + values.size() + " dimensions; " + DIMENSIONS + " required");
        }
        float[] v = new float[DIMENSIONS];
        for (int i = 0; i < DIMENSIONS; i++) {
            v[i] = values.get(i).floatValue();
        }
        return v;
    }

    public String provider() {
        return "OPENAI_COMPATIBLE";
    }

    public String model() {
        return model;
    }
}
