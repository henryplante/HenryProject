package com.clearpath.review.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "clearpath.session")
public record SessionProperties(String secret, String cookieName) {}
