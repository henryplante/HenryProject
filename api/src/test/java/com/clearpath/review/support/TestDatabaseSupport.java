package com.clearpath.review.support;

import org.testcontainers.DockerClientFactory;

public final class TestDatabaseSupport {

    private TestDatabaseSupport() {}

    public static boolean isDockerAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable ignored) {
            return false;
        }
    }

    public static String testDatabaseUrl() {
        String fromEnv = System.getenv("TEST_DATABASE_URL");
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        return "jdbc:postgresql://localhost:5432/clearpath_test";
    }

    public static String testDatabaseUsername() {
        String fromEnv = System.getenv("TEST_DATABASE_USERNAME");
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        return "clearpath";
    }

    public static String testDatabasePassword() {
        String fromEnv = System.getenv("TEST_DATABASE_PASSWORD");
        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv;
        }
        return "clearpath";
    }
}
