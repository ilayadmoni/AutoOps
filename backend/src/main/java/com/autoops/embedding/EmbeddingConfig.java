package com.autoops.embedding;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Locale;

@Configuration
public class EmbeddingConfig {
    private static final Logger log = LoggerFactory.getLogger(EmbeddingConfig.class);

    /** EMBEDDING_PROVIDER=LOCAL (default, offline) or OPENAI_COMPATIBLE (uses EMBEDDING_BASE_URL / EMBEDDING_API_KEY / EMBEDDING_MODEL). */
    @Bean
    EmbeddingProvider embeddingProvider(@Value("${autoops.embedding.provider:LOCAL}") String provider,
                                        @Value("${autoops.embedding.base-url:}") String baseUrl,
                                        @Value("${autoops.embedding.api-key:}") String apiKey,
                                        @Value("${autoops.embedding.model:}") String model) {
        if ("OPENAI_COMPATIBLE".equals(provider.toUpperCase(Locale.ROOT))) {
            if (baseUrl.isBlank() || apiKey.isBlank() || model.isBlank()) {
                throw new IllegalStateException("EMBEDDING_PROVIDER=OPENAI_COMPATIBLE requires EMBEDDING_BASE_URL, EMBEDDING_API_KEY and EMBEDDING_MODEL");
            }
            log.info("Using OpenAI-compatible embeddings model {}", model);
            return new OpenAiCompatibleEmbeddingProvider(baseUrl, apiKey, model);
        }
        return new HashEmbeddingProvider();
    }
}
