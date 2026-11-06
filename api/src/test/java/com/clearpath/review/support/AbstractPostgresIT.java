package com.clearpath.review.support;

import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class AbstractPostgresIT {

    private static final boolean USE_TESTCONTAINERS = TestDatabaseSupport.isDockerAvailable();

    @SuppressWarnings("resource")
    private static final PostgreSQLContainer<?> POSTGRES = USE_TESTCONTAINERS
            ? new PostgreSQLContainer<>("postgres:16")
                    .withDatabaseName("clearpath_test")
                    .withUsername("clearpath")
                    .withPassword("clearpath")
            : null;

    static {
        if (USE_TESTCONTAINERS) {
            POSTGRES.start();
        }
    }

    @DynamicPropertySource
    static void configureDataSource(DynamicPropertyRegistry registry) {
        if (USE_TESTCONTAINERS) {
            registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
            registry.add("spring.datasource.username", POSTGRES::getUsername);
            registry.add("spring.datasource.password", POSTGRES::getPassword);
        } else {
            registry.add("spring.datasource.url", TestDatabaseSupport::testDatabaseUrl);
            registry.add("spring.datasource.username", TestDatabaseSupport::testDatabaseUsername);
            registry.add("spring.datasource.password", TestDatabaseSupport::testDatabasePassword);
        }
    }

    @Autowired
    private DataSource dataSource;

    @BeforeAll
    void resetPublicSchema() throws Exception {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS public CASCADE");
            statement.execute("CREATE SCHEMA public");
            statement.execute("GRANT ALL ON SCHEMA public TO public");
        }
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .failOnMissingLocations(false)
                .load();
        flyway.migrate();
    }
}
