package com.clearpath.review.auth;

import java.util.List;
import java.util.UUID;

public record CurrentUser(UUID id, String name, String email, List<UUID> groupIds) {}
