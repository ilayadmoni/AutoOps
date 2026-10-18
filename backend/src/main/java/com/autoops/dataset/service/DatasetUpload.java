package com.autoops.dataset.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.dataset.dto.DatasetDtos;
import com.autoops.dataset.entity.DatasetImport;
import com.autoops.dataset.repository.DatasetImportRepository;
import com.autoops.files.service.ObjectStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ExecutorService;

@Service
public class DatasetUpload {
    private static final Logger log = LoggerFactory.getLogger(DatasetUpload.class);
    private final DatasetImportRepository repo;
    private final ObjectStorageService storage;
    private final AuditService audit;
    private final DatasetAnalysis analysis;
    private final ExecutorService worker;
    private final long maxBytes;

    public DatasetUpload(DatasetImportRepository repo, ObjectStorageService storage, AuditService audit, DatasetAnalysis analysis, @Qualifier("datasetWorker") ExecutorService worker, @Value("${autoops.datasets.max-size:20MB}") DataSize maxSize) {
        this.repo = repo;
        this.storage = storage;
        this.audit = audit;
        this.analysis = analysis;
        this.worker = worker;
        this.maxBytes = maxSize.toBytes();
    }

    DatasetDtos.DatasetView upload(Long adminId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("A CSV or JSON file is required");
        }
        if (file.getSize() > maxBytes) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Dataset exceeds the maximum allowed size");
        }
        String name = Objects.toString(file.getOriginalFilename(), "dataset.csv").replaceAll("[\\p{Cntrl}/\\\\\"]", "_");
        DatasetFormat format = DatasetFormat.fromFilename(name)
                .orElseThrow(() -> ApiException.validation("Only .csv and .json datasets are supported"));
        String key = "datasets/" + UUID.randomUUID() + format.extension();
        String checksum;
        try (InputStream raw = file.getInputStream(); DigestInputStream in = new DigestInputStream(raw, MessageDigest.getInstance("SHA-256"))) {
            storage.put(key, in, file.getSize(), format.contentType());
            checksum = HexFormat.of().formatHex(in.getMessageDigest().digest());
        } catch (ObjectStorageService.StorageException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", e.getMessage());
        } catch (Exception e) {
            throw ApiException.validation("Unable to read the uploaded dataset");
        }
        DatasetImport d = new DatasetImport();
        d.setFilename(name.length() > 200 ? name.substring(name.length() - 200) : name);
        d.setObjectKey(key);
        d.setSizeBytes(file.getSize());
        d.setChecksum(checksum);
        d.setUploadedBy(adminId);
        d.setStatus("UPLOADED");
        d = repo.save(d);
        audit.record(adminId, "DATASET_UPLOADED", "DATASET", d.getId(), Map.of("filename", d.getFilename(), "size", file.getSize(), "sha256", checksum));
        Long id = d.getId();
        worker.execute(() -> analysis.analyze(id));
        return DatasetDtos.DatasetView.from(d, null);
    }

}
