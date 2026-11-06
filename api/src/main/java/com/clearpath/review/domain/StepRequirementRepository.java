package com.clearpath.review.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StepRequirementRepository extends JpaRepository<StepRequirement, UUID> {

    List<StepRequirement> findByStepId(UUID stepId);
}
