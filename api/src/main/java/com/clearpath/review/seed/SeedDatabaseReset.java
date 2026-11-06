package com.clearpath.review.seed;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("seed")
public class SeedDatabaseReset {

    private final JdbcTemplate jdbc;

    public SeedDatabaseReset(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void truncateSeedTables() {
        jdbc.execute(
                """
                TRUNCATE TABLE
                    notification,
                    favorite,
                    activity,
                    comment,
                    review,
                    cycle_requirement,
                    cycle_step,
                    review_cycle,
                    material,
                    material_version,
                    file_blob,
                    step_requirement,
                    workflow_step,
                    product,
                    membership,
                    app_user,
                    user_group
                RESTART IDENTITY CASCADE
                """);
    }
}
