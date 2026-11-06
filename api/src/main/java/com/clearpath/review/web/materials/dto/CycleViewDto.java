package com.clearpath.review.web.materials.dto;

import java.util.List;

public record CycleViewDto(CycleStatusDto status, int currentPosition, List<CycleStepViewDto> steps) {}
