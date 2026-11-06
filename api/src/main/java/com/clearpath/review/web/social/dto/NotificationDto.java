package com.clearpath.review.web.social.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record NotificationDto(
        UUID id,
        String kind,
        UUID materialId,
        String materialTitle,
        boolean read,
        Instant createdAt,
        Map<String, Object> detail) {}
