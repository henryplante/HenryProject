package com.clearpath.review.config.hosting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

class HostingEnvironmentPostProcessorTest {

    @Test
    void mapsDatabaseUrlWhenSpringDatasourceUrlUnset() {
        MockEnvironment environment = new MockEnvironment();
        HostingEnvironmentPostProcessor processor = processor(Map.of(
                "DATABASE_URL", "postgres://clearpath:clearpath@localhost:5432/clearpath_ops01"));

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://localhost:5432/clearpath_ops01");
        assertThat(environment.getProperty("spring.datasource.username")).isEqualTo("clearpath");
        assertThat(environment.getProperty("spring.datasource.password")).isEqualTo("clearpath");
    }

    @Test
    void skipsDatabaseUrlWhenSpringDatasourceUrlSet() {
        MockEnvironment environment = new MockEnvironment();
        HostingEnvironmentPostProcessor processor = processor(Map.of(
                "SPRING_DATASOURCE_URL", "jdbc:postgresql://localhost:5432/other",
                "DATABASE_URL", "postgres://clearpath:clearpath@localhost:5432/clearpath_ops01"));

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("spring.datasource.url")).isNull();
    }

    @Test
    void activatesProdStartupSeedProfile() {
        MockEnvironment environment = new MockEnvironment();
        HostingEnvironmentPostProcessor processor = processor(Map.of("SEED_ON_STARTUP", "true"));

        processor.postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getActiveProfiles()).contains("prod-startup-seed");
    }

    @Test
    void rejectsDefaultSessionSecretInProd() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("spring.profiles.active", "prod");
        HostingEnvironmentPostProcessor processor = processor(Map.of(
                "SPRING_PROFILES_ACTIVE", "prod",
                "SESSION_SECRET", HostingEnvironmentPostProcessor.DEV_SESSION_SECRET));

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, new SpringApplication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SESSION_SECRET");
    }

    @Test
    void allowsCustomSessionSecretInProd() {
        MockEnvironment environment = new MockEnvironment();
        environment.setProperty("spring.profiles.active", "prod");
        HostingEnvironmentPostProcessor processor = processor(Map.of(
                "SPRING_PROFILES_ACTIVE", "prod", "SESSION_SECRET", "prod-secret-value-long-enough"));

        processor.postProcessEnvironment(environment, new SpringApplication());
    }

    private static HostingEnvironmentPostProcessor processor(Map<String, String> env) {
        Map<String, String> copy = new HashMap<>(env);
        return new HostingEnvironmentPostProcessor(copy::get);
    }
}
