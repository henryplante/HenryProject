package com.clearpath.review.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaterialVersionRepository extends JpaRepository<MaterialVersion, UUID> {

    List<MaterialVersion> findByMaterialIdOrderByNumberAsc(UUID materialId);

    List<MaterialVersion> findByMaterialIdOrderByNumberDesc(UUID materialId);

    Optional<MaterialVersion> findByMaterialIdAndNumber(UUID materialId, int number);
}
