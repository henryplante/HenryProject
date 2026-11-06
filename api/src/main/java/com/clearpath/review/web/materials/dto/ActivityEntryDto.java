package com.clearpath.review.web.materials.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ActivityEntryDto(
        UUID id,
        UUID materialId,
        UUID actorId,
        String actorName,
        String type,
        Map<String, Object> detail,
        Instant createdAt) {}
