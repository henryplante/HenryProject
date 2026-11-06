package com.clearpath.review.web.materials.dto;

import java.util.List;

public record CycleStepViewDto(int position, String name, CycleStepStateDto state, List<CycleRequirementViewDto> requirements) {}
