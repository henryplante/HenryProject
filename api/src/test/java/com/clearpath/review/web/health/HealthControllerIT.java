package com.clearpath.review.web.health;

import static org.assertj.core.api.Assertions.assertThat;

import com.clearpath.review.support.AbstractPostgresIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class HealthControllerIT extends AbstractPostgresIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void healthReturnsOkWhenDatabaseIsUp() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/health", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"status\":\"ok\"");
    }
}
