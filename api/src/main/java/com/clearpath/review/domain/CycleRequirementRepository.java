package com.clearpath.review.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CycleRequirementRepository extends JpaRepository<CycleRequirement, UUID> {

    List<CycleRequirement> findByCycleStepId(UUID cycleStepId);
}
