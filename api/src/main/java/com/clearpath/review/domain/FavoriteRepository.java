package com.clearpath.review.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteRepository extends JpaRepository<Favorite, FavoriteId> {

    List<Favorite> findByIdUserId(UUID userId);

    boolean existsByIdUserIdAndIdMaterialId(UUID userId, UUID materialId);

    void deleteByIdUserIdAndIdMaterialId(UUID userId, UUID materialId);
}
