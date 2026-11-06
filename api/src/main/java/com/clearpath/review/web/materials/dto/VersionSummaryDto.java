package com.clearpath.review.web.materials.dto;

import com.clearpath.review.service.materials.VersionStatus;
import java.time.Instant;
import java.util.UUID;

public record VersionSummaryDto(
        UUID id,
        int number,
        Instant uploadedAt,
        String uploadedByName,
        VersionStatus versionStatus,
        Instant approvedUntil) {}
