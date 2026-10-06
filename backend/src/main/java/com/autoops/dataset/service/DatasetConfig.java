package com.autoops.dataset.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class DatasetConfig {
    /** Datasets are analyzed and imported one at a time, off the request thread. */
    @Bean(name = "datasetWorker", destroyMethod = "shutdownNow")
    ExecutorService datasetWorker() {
        return Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "dataset-worker");
            t.setDaemon(true);
            return t;
        });
    }

    @Bean
    @Order(40)
    ApplicationRunner datasetRecovery(DatasetService datasets) {
        return (ApplicationArguments args) -> datasets.resumeAfterRestart();
    }
}
