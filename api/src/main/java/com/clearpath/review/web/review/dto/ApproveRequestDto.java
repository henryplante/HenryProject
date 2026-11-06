package com.clearpath.review.web.review.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ApproveRequestDto(@NotNull UUID groupId) {}
