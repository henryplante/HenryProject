package com.clearpath.review.web.tasks;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.auth.CurrentUserLoader;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

public class DbCurrentUserLoader implements CurrentUserLoader {

    private final JdbcTemplate jdbcTemplate;

    public DbCurrentUserLoader(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public CurrentUser load(UUID userId) {
        var user = jdbcTemplate.query(
                "SELECT id, name, email FROM app_user WHERE id = ?",
                rs -> rs.next()
                        ? new CurrentUser(
                                rs.getObject("id", UUID.class),
                                rs.getString("name"),
                                rs.getString("email"),
                                List.of())
                        : null,
                userId);
        if (user == null) {
            return new CurrentUser(userId, "Unknown", userId + "@unknown.local", List.of());
        }
        List<UUID> groupIds = jdbcTemplate.query(
                "SELECT group_id FROM membership WHERE user_id = ?",
                (rs, rowNum) -> rs.getObject("group_id", UUID.class),
                userId);
        return new CurrentUser(user.id(), user.name(), user.email(), groupIds);
    }
}
