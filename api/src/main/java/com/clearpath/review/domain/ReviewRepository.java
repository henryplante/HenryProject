package com.clearpath.review.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    List<Review> findByCycleId(UUID cycleId);

    List<Review> findByCycleIdAndPosition(UUID cycleId, int position);

    List<Review> findByCycleIdAndPositionAndGroupId(UUID cycleId, int position, UUID groupId);

    Optional<Review> findByCycleIdAndPositionAndGroupIdAndUserId(
            UUID cycleId, int position, UUID groupId, UUID userId);
}
