package com.autoops.execution.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread pools for the execution engine. Pool sizes bound total server load; the per-execution machine concurrency
 * (1-3) is enforced separately by the engine's scheduler.
 */
@Configuration
@EnableAsync
public class ExecutionThreadsConfig {
    @Bean(name = "executionCoordinatorPool", destroyMethod = "shutdownNow")
    public ExecutorService coordinatorPool(@Value("${autoops.execution.max-active-executions:64}") int max) {
        return new ThreadPoolExecutor(0, max, 60, TimeUnit.SECONDS, new SynchronousQueue<>(), named("exec-coord"),
                new ThreadPoolExecutor.AbortPolicy());
    }

    @Bean(name = "executionMachinePool", destroyMethod = "shutdownNow")
    public ExecutorService machinePool(@Value("${autoops.execution.worker-threads:24}") int threads) {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(threads, threads, 60, TimeUnit.SECONDS, new LinkedBlockingQueue<>(), named("exec-machine"));
        pool.allowCoreThreadTimeOut(true);
        return pool;
    }

    private static java.util.concurrent.ThreadFactory named(String prefix) {
        AtomicInteger n = new AtomicInteger();
        return r -> {
            Thread t = new Thread(r, prefix + "-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        };
    }
}
