package com.autoops.embedding;

/** Produces fixed-size vectors matching the command_definitions.embedding column (vector(384)). */
public interface EmbeddingProvider {
    int DIMENSIONS = 384;

    float[] embed(String text);

    String provider();

    String model();
}
