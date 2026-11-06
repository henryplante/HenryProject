package com.clearpath.review.seed;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("prod-startup-seed & !test")
public class ProdStartupSeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ProdStartupSeedRunner.class);

    private final SeedDataLoader dataLoader;

    public ProdStartupSeedRunner(SeedDataLoader dataLoader) {
        this.dataLoader = dataLoader;
    }

    @Override
    public void run(String... args) {
        log.info("SEED_ON_STARTUP enabled — ensuring demo seed data is present");
        dataLoader.ensureSeeded();
    }
}
