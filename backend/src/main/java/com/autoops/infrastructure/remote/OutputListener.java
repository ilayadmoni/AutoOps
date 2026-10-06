package com.autoops.infrastructure.remote;

@FunctionalInterface
public interface OutputListener {
    void onOutput(String stream, String chunk);
}
