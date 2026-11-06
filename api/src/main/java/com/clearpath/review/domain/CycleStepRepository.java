package com.clearpath.review.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CycleStepRepository extends JpaRepository<CycleStep, UUID> {

    List<CycleStep> findByCycleIdOrderByPositionAsc(UUID cycleId);

    Optional<CycleStep> findByCycleIdAndPosition(UUID cycleId, int position);
}
