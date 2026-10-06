package com.autoops.files.service;

import io.minio.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;

/** Thin MinIO/S3 wrapper. Object keys are always generated server-side; there is no endpoint that accepts a key. */
@Service
public class ObjectStorageService {
    private static final Logger log = LoggerFactory.getLogger(ObjectStorageService.class);
    private final MinioClient minio;
    private final String bucket;
    private volatile boolean bucketReady;

    public ObjectStorageService(@Value("${autoops.minio.endpoint}") String endpoint,
                                @Value("${autoops.minio.access-key}") String access,
                                @Value("${autoops.minio.secret-key}") String secret,
                                @Value("${autoops.minio.bucket}") String bucket) {
        this.minio = MinioClient.builder().endpoint(endpoint).credentials(access, secret).build();
        this.bucket = bucket;
    }

    private void ensureBucket() throws Exception {
        if (bucketReady) {
            return;
        }
        synchronized (this) {
            if (!bucketReady) {
                if (!minio.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    minio.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                }
                bucketReady = true;
            }
        }
    }

    /** Streams exactly {@code size} bytes; the object is not created if the stream ends early. */
    public void put(String key, InputStream in, long size, String contentType) {
        try {
            ensureBucket();
            minio.putObject(PutObjectArgs.builder().bucket(bucket).object(key).stream(in, size, -1)
                    .contentType(contentType == null ? "application/octet-stream" : contentType).build());
        } catch (Exception e) {
            log.warn("Object storage upload failed for {}: {}", key, e.getMessage());
            throw new StorageException("Object storage is unavailable");
        }
    }

    public InputStream get(String key) {
        try {
            ensureBucket();
            return minio.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            log.warn("Object storage read failed for {}: {}", key, e.getMessage());
            throw new StorageException("Stored file content is unavailable");
        }
    }

    public void delete(String key) {
        try {
            ensureBucket();
            minio.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            log.warn("Object storage delete failed for {}: {}", key, e.getMessage());
            throw new StorageException("Object storage is unavailable");
        }
    }

    public static class StorageException extends RuntimeException {
        public StorageException(String message) {
            super(message);
        }
    }
}
