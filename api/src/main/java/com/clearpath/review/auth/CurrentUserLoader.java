package com.clearpath.review.auth;

import java.util.UUID;

public interface CurrentUserLoader {

    CurrentUser load(UUID userId);
}
