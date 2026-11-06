package com.clearpath.review.auth;

import java.util.UUID;

public record SessionPayload(UUID userId, long exp) {}
