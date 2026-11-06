package com.clearpath.review.auth;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class StubCurrentUserLoader implements CurrentUserLoader {

    @Override
    public CurrentUser load(UUID userId) {
        return new CurrentUser(userId, "Stub User", userId + "@stub.local", List.of());
    }
}
