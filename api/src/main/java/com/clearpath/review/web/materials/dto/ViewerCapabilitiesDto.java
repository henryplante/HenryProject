package com.clearpath.review.web.materials.dto;

import java.util.List;

public record ViewerCapabilitiesDto(
        boolean canStartReview,
        String startBlockedReason,
        boolean canApprove,
        List<ApprovableGroupDto> approvableGroups) {}
