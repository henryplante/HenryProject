package com.clearpath.review.domain;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewCycleRepository extends JpaRepository<ReviewCycle, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ReviewCycle c WHERE c.id = :id")
    Optional<ReviewCycle> findByIdForUpdate(@Param("id") UUID id);

    Optional<ReviewCycle> findByMaterialIdAndStatus(UUID materialId, ReviewCycleStatus status);

    List<ReviewCycle> findByMaterialId(UUID materialId);

    List<ReviewCycle> findByVersionId(UUID versionId);

    Optional<ReviewCycle> findByVersionIdAndStatus(UUID versionId, ReviewCycleStatus status);

    Optional<ReviewCycle> findFirstByVersionIdAndStatusOrderByEndedAtDescStartedAtDesc(
            UUID versionId, ReviewCycleStatus status);

    boolean existsByMaterial_Product_Id(UUID productId);
}
