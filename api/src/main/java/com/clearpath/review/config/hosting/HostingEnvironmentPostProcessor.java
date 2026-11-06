package com.clearpath.review.config.hosting;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.util.StringUtils;

public class HostingEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String DEV_SESSION_SECRET = "dev-change-me-in-production";

    private final Function<String, String> env;

    public HostingEnvironmentPostProcessor() {
        this(System::getenv);
    }

    HostingEnvironmentPostProcessor(Function<String, String> env) {
        this.env = env;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> derived = new HashMap<>();

        if (!StringUtils.hasText(env.apply("SPRING_DATASOURCE_URL"))) {
            String databaseUrl = env.apply("DATABASE_URL");
            if (StringUtils.hasText(databaseUrl)) {
                DatabaseUrlConverter.Parsed parsed = DatabaseUrlConverter.parse(databaseUrl);
                derived.put("spring.datasource.url", parsed.jdbcUrl());
                derived.put("spring.datasource.username", parsed.username());
                derived.put("spring.datasource.password", parsed.password());
            }
        }

        if (isTruthy(env.apply("SEED_ON_STARTUP"))) {
            environment.addActiveProfile("prod-startup-seed");
        }

        if (!derived.isEmpty()) {
            environment.getPropertySources().addFirst(new MapPropertySource("clearpathHosting", derived));
        }

        if (activeProfilesInclude(environment, env, "prod")) {
            String secret = firstNonBlank(env.apply("SESSION_SECRET"), environment.getProperty("clearpath.session.secret"));
            if (!StringUtils.hasText(secret) || DEV_SESSION_SECRET.equals(secret)) {
                throw new IllegalStateException(
                        "SESSION_SECRET must be set to a strong random value when SPRING_PROFILES_ACTIVE includes "
                                + "'prod'. The default dev secret is not allowed in production. On Render, render.yaml "
                                + "sets SESSION_SECRET with generateValue: true.");
            }
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    private static boolean activeProfilesInclude(
            ConfigurableEnvironment environment, Function<String, String> env, String profile) {
        for (String active : environment.getActiveProfiles()) {
            if (profile.equals(active)) {
                return true;
            }
        }
        String configured =
                firstNonBlank(env.apply("SPRING_PROFILES_ACTIVE"), environment.getProperty("spring.profiles.active"));
        if (!StringUtils.hasText(configured)) {
            return false;
        }
        for (String part : configured.split(",")) {
            if (profile.equals(part.trim())) {
                return true;
            }
        }
        return false;
    }

    private static boolean isTruthy(String value) {
        return value != null && (value.equalsIgnoreCase("true") || value.equals("1") || value.equalsIgnoreCase("yes"));
    }

    private static String firstNonBlank(String first, String second) {
        if (StringUtils.hasText(first)) {
            return first.trim();
        }
        if (StringUtils.hasText(second)) {
            return second.trim();
        }
        return null;
    }
}
