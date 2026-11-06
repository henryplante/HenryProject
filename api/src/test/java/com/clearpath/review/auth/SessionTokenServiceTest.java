package com.clearpath.review.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SessionTokenServiceTest {

    private SessionTokenService service;

    @BeforeEach
    void setUp() {
        SessionProperties properties = new SessionProperties("unit-test-secret", "clearpath_session", false);
        service = new SessionTokenService(new ObjectMapper(), properties);
    }

    @Test
    void signAndVerifyRoundTrip() {
        UUID userId = UUID.randomUUID();
        Instant expires = Instant.now().plusSeconds(3600);
        String token = service.sign(userId, expires);

        SessionPayload payload = service.verify(token);

        assertThat(payload).isNotNull();
        assertThat(payload.userId()).isEqualTo(userId);
        assertThat(payload.exp()).isEqualTo(expires.getEpochSecond());
    }

    @Test
    void verifyRejectsTamperedToken() {
        String token = service.sign(UUID.randomUUID(), Instant.now().plusSeconds(3600));
        String tampered = token.substring(0, token.length() - 2) + "xx";

        assertThat(service.verify(tampered)).isNull();
    }

    @Test
    void verifyRejectsExpiredToken() {
        UUID userId = UUID.randomUUID();
        String token = service.sign(userId, Instant.now().minusSeconds(10));

        assertThat(service.verify(token)).isNull();
    }

    @Test
    void verifyRejectsBlankToken() {
        assertThat(service.verify("")).isNull();
        assertThat(service.verify(null)).isNull();
    }
}
