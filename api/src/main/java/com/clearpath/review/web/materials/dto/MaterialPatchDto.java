package com.clearpath.review.web.materials.dto;

import com.clearpath.review.domain.MaterialAudience;
import com.clearpath.review.domain.MaterialChannel;
import java.util.UUID;

public record MaterialPatchDto(
        String title,
        UUID productId,
        MaterialChannel channel,
        MaterialAudience audience,
        String intendedUse,
        UUID ownerId) {}
