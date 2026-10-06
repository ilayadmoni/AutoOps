package com.autoops.dataset.repository;

import com.autoops.dataset.entity.DatasetImport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface DatasetImportRepository extends JpaRepository<DatasetImport, Long> {
    List<DatasetImport> findAllByOrderByIdDesc();

    List<DatasetImport> findByStatusIn(Collection<String> statuses);
}
