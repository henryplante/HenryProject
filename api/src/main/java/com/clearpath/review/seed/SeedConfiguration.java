package com.clearpath.review.seed;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile({"seed", "prod-startup-seed"})
@EnableConfigurationProperties(SeedProperties.class)
public class SeedConfiguration {}
