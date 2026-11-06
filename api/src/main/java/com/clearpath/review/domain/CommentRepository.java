package com.clearpath.review.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentRepository extends JpaRepository<Comment, UUID> {

    List<Comment> findByVersionIdOrderByCreatedAtAsc(UUID versionId);
}
