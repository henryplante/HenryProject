package com.clearpath.review.config.hosting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DatabaseUrlConverterTest {

    @Test
    void parsesPostgresqlUrlWithSslMode() {
        DatabaseUrlConverter.Parsed parsed = DatabaseUrlConverter.parse(
                "postgresql://neondb_owner:sec%40ret@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require");

        assertThat(parsed.username()).isEqualTo("neondb_owner");
        assertThat(parsed.password()).isEqualTo("sec@ret");
        assertThat(parsed.jdbcUrl())
                .isEqualTo(
                        "jdbc:postgresql://ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require");
    }

    @Test
    void parsesPostgresSchemeAlias() {
        DatabaseUrlConverter.Parsed parsed =
                DatabaseUrlConverter.parse("postgres://clearpath:clearpath@localhost:5432/clearpath_ops01");

        assertThat(parsed.username()).isEqualTo("clearpath");
        assertThat(parsed.password()).isEqualTo("clearpath");
        assertThat(parsed.jdbcUrl()).isEqualTo("jdbc:postgresql://localhost:5432/clearpath_ops01");
    }

    @Test
    void rejectsJdbcInput() {
        assertThatThrownBy(() -> DatabaseUrlConverter.parse("jdbc:postgresql://localhost/db"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not JDBC");
    }
}
