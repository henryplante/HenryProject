package com.clearpath.review.domain;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaterialRepository extends JpaRepository<Material, UUID> {}
