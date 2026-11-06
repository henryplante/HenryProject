package com.clearpath.review.seed;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("seed & !test")
public class SeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final SeedProperties properties;
    private final SeedDatabaseReset databaseReset;
    private final SeedDataLoader dataLoader;

    public SeedRunner(SeedProperties properties, SeedDatabaseReset databaseReset, SeedDataLoader dataLoader) {
        this.properties = properties;
        this.databaseReset = databaseReset;
        this.dataLoader = dataLoader;
    }

    @Override
    public void run(String... args) {
        if (!properties.isAutorun()) {
            return;
        }
        if (properties.isReset()) {
            log.warn("seed.reset=true — truncating demo tables");
            databaseReset.truncateSeedTables();
            dataLoader.loadAll();
            return;
        }
        dataLoader.ensureSeeded();
    }
}
