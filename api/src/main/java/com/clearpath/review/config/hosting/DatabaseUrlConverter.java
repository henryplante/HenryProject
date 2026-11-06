package com.clearpath.review.config.hosting;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public final class DatabaseUrlConverter {

    public record Parsed(String jdbcUrl, String username, String password) {}

    private DatabaseUrlConverter() {}

    public static Parsed parse(String databaseUrl) {
        if (databaseUrl == null || databaseUrl.isBlank()) {
            throw new IllegalArgumentException("DATABASE_URL is blank");
        }
        String trimmed = databaseUrl.trim();
        if (trimmed.startsWith("jdbc:")) {
            throw new IllegalArgumentException("DATABASE_URL must be a postgres:// or postgresql:// URI, not JDBC");
        }
        if (!trimmed.startsWith("postgres://") && !trimmed.startsWith("postgresql://")) {
            throw new IllegalArgumentException("Unsupported DATABASE_URL scheme (expected postgres:// or postgresql://)");
        }
        try {
            URI uri = new URI(trimmed.replaceFirst("^postgres://", "postgresql://"));
            String userInfo = uri.getUserInfo();
            if (userInfo == null || userInfo.isBlank()) {
                throw new IllegalArgumentException("DATABASE_URL is missing credentials");
            }
            String[] credentials = userInfo.split(":", 2);
            String username = decode(credentials[0]);
            String password = credentials.length > 1 ? decode(credentials[1]) : "";
            String database = uri.getPath();
            if (database == null || database.isBlank() || "/".equals(database)) {
                throw new IllegalArgumentException("DATABASE_URL is missing a database name");
            }
            if (database.startsWith("/")) {
                database = database.substring(1);
            }
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                throw new IllegalArgumentException("DATABASE_URL is missing a host");
            }
            StringBuilder jdbc = new StringBuilder("jdbc:postgresql://").append(host);
            if (uri.getPort() > 0) {
                jdbc.append(':').append(uri.getPort());
            }
            jdbc.append('/').append(database);
            if (uri.getQuery() != null && !uri.getQuery().isBlank()) {
                jdbc.append('?').append(uri.getQuery());
            }
            return new Parsed(jdbc.toString(), username, password);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid DATABASE_URL: " + e.getMessage(), e);
        }
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }
}
