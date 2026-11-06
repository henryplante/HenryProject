package com.clearpath.review.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewCycleRepository extends JpaRepository<ReviewCycle, UUID> {

    Optional<ReviewCycle> findByMaterialIdAndStatus(UUID materialId, ReviewCycleStatus status);

    List<ReviewCycle> findByMaterialId(UUID materialId);

    List<ReviewCycle> findByVersionId(UUID versionId);

    Optional<ReviewCycle> findByVersionIdAndStatus(UUID versionId, ReviewCycleStatus status);

    boolean existsByMaterial_Product_Id(UUID productId);
}
