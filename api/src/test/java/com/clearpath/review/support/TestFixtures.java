package com.clearpath.review.support;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

public final class TestFixtures {

    private TestFixtures() {}

    public static UUID insertUser(JdbcTemplate jdbc, PasswordEncoder encoder, String email, String name, String password) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO app_user (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                id,
                name,
                email,
                encoder.encode(password),
                Timestamp.from(Instant.now()));
        return id;
    }

    public static UUID insertGroup(JdbcTemplate jdbc, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO user_group (id, name) VALUES (?, ?)", id, name);
        return id;
    }

    public static void addMembership(JdbcTemplate jdbc, UUID userId, UUID groupId) {
        jdbc.update("INSERT INTO membership (user_id, group_id) VALUES (?, ?)", userId, groupId);
    }
}
