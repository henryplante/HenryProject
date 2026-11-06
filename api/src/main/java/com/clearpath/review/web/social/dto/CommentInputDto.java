package com.clearpath.review.web.social.dto;

import jakarta.validation.constraints.NotBlank;

public record CommentInputDto(@NotBlank String body) {}
