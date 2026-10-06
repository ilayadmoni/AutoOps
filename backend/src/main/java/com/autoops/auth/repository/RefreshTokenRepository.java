package com.autoops.auth.repository;
import com.autoops.auth.entity.RefreshToken;import org.springframework.data.jpa.repository.JpaRepository;import java.util.Optional;public interface RefreshTokenRepository extends JpaRepository<RefreshToken,Long>{Optional<RefreshToken> findByTokenHash(String hash);}
