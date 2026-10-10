package com.autoops.credential.repository;

import com.autoops.credential.entity.Credential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CredentialRepository extends JpaRepository<Credential, Long> {
    List<Credential> findByDeletedAtIsNullOrderByNameAsc();

    Optional<Credential> findByIdAndDeletedAtIsNull(Long id);
}
