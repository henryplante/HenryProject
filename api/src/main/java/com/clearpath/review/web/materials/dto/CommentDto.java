package com.clearpath.review.web.materials.dto;

import java.time.Instant;
import java.util.UUID;

public record CommentDto(UUID id, UUID versionId, UUID authorId, String authorName, String body, Instant createdAt) {}
