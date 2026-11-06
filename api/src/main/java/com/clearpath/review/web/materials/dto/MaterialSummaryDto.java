package com.clearpath.review.web.materials.dto;

import com.clearpath.review.domain.MaterialChannel;
import com.clearpath.review.service.materials.MaterialStatus;
import java.time.Instant;
import java.util.UUID;

public record MaterialSummaryDto(
        UUID id,
        String title,
        UUID productId,
        String productName,
        MaterialChannel channel,
        MaterialStatus status,
        UUID ownerId,
        int currentVersionNumber,
        boolean favorited,
        Instant approvedUntil) {}
