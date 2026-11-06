package com.clearpath.review.web.materials.dto;

import java.util.UUID;

public record CycleRequirementViewDto(UUID groupId, String groupName, int have, int need) {}
