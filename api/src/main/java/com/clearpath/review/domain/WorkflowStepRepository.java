package com.clearpath.review.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowStepRepository extends JpaRepository<WorkflowStep, UUID> {

    List<WorkflowStep> findByProductIdOrderByPositionAsc(UUID productId);
}
