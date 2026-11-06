package com.clearpath.review.web.social;

import static org.assertj.core.api.Assertions.assertThat;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.auth.CurrentUserLoader;
import com.clearpath.review.auth.SessionProperties;
import com.clearpath.review.auth.SessionTokenService;
import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.MembershipRepository;
import com.clearpath.review.support.AbstractPostgresIT;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

@Import(SocialControllerIT.TestAuthConfig.class)
class SocialControllerIT extends AbstractPostgresIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionTokenService sessionTokenService;

    @Autowired
    private SessionProperties sessionProperties;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private SocialFixtures fixtures;

    @BeforeEach
    void resetData() {
        jdbcTemplate.execute(
                """
                TRUNCATE notification, favorite, activity, comment, review, cycle_requirement, cycle_step,
                review_cycle, material_version, material, file_blob, step_requirement, workflow_step, product,
                membership, user_group, app_user RESTART IDENTITY CASCADE
                """);
        fixtures = new SocialFixtures(jdbcTemplate);
    }

    @Test
    void createCommentNotifiesOwnerAndSkipsWhenOwnerComments() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewer = fixtures.insertUser("Reviewer");
        UUID productId = fixtures.insertProduct();
        var material = fixtures.insertMaterial(owner, productId, "Comment material");

        HttpHeaders reviewerHeaders = authHeaders(reviewer);
        ResponseEntity<String> created = restTemplate.exchange(
                "/api/versions/" + material.versionId() + "/comments",
                HttpMethod.POST,
                jsonEntity(reviewerHeaders, "{\"body\":\"Please fix the headline\"}"),
                String.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode comment = objectMapper.readTree(created.getBody());
        assertThat(comment.get("authorName").asText()).isEqualTo("Reviewer");
        assertThat(comment.get("body").asText()).isEqualTo("Please fix the headline");

        ResponseEntity<String> notifications = restTemplate.exchange(
                "/api/notifications", HttpMethod.GET, new HttpEntity<>(authHeaders(owner)), String.class);
        JsonNode feed = objectMapper.readTree(notifications.getBody());
        assertThat(feed.get("unreadCount").asInt()).isEqualTo(1);
        assertThat(feed.get("items").get(0).get("kind").asText()).isEqualTo("comment_added");
        assertThat(feed.get("items").get(0).get("materialTitle").asText()).isEqualTo("Comment material");

        Instant updatedBefore = fixtures.materialUpdatedAt(material.materialId());
        restTemplate.exchange(
                "/api/versions/" + material.versionId() + "/comments",
                HttpMethod.POST,
                jsonEntity(authHeaders(owner), "{\"body\":\"Owner reply\"}"),
                String.class);
        Instant updatedAfter = fixtures.materialUpdatedAt(material.materialId());
        assertThat(updatedAfter).isEqualTo(updatedBefore);
        assertThat(fixtures.countNotifications(owner, "comment_added")).isEqualTo(1);
    }

    @Test
    void blankCommentBodyIsRejected() {
        UUID owner = fixtures.insertUser("Owner");
        UUID productId = fixtures.insertProduct();
        var material = fixtures.insertMaterial(owner, productId, "Validation material");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/versions/" + material.versionId() + "/comments",
                HttpMethod.POST,
                jsonEntity(authHeaders(owner), "{\"body\":\"   \"}"),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void favoritesToggleAndReflectInSummaries() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID viewer = fixtures.insertUser("Viewer");
        UUID productId = fixtures.insertProduct();
        var material = fixtures.insertMaterial(owner, productId, "Favorite material");
        HttpHeaders viewerHeaders = authHeaders(viewer);

        ResponseEntity<Void> firstFavorite = restTemplate.exchange(
                "/api/materials/" + material.materialId() + "/favorite",
                HttpMethod.PUT,
                new HttpEntity<>(viewerHeaders),
                Void.class);
        assertThat(firstFavorite.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<Void> duplicateFavorite = restTemplate.exchange(
                "/api/materials/" + material.materialId() + "/favorite",
                HttpMethod.PUT,
                new HttpEntity<>(viewerHeaders),
                Void.class);
        assertThat(duplicateFavorite.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<String> list = restTemplate.exchange(
                "/api/materials", HttpMethod.GET, new HttpEntity<>(viewerHeaders), String.class);
        JsonNode items = objectMapper.readTree(list.getBody());
        assertThat(items.get(0).get("favorited").asBoolean()).isTrue();

        ResponseEntity<Void> unfavorite = restTemplate.exchange(
                "/api/materials/" + material.materialId() + "/favorite",
                HttpMethod.DELETE,
                new HttpEntity<>(viewerHeaders),
                Void.class);
        assertThat(unfavorite.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        restTemplate.exchange(
                "/api/materials/" + material.materialId() + "/favorite",
                HttpMethod.DELETE,
                new HttpEntity<>(viewerHeaders),
                Void.class);

        ResponseEntity<String> after = restTemplate.exchange(
                "/api/materials", HttpMethod.GET, new HttpEntity<>(viewerHeaders), String.class);
        assertThat(objectMapper.readTree(after.getBody()).get(0).get("favorited").asBoolean())
                .isFalse();
    }

    @Test
    void notificationsListReadAndOwnership() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID other = fixtures.insertUser("Other");
        UUID productId = fixtures.insertProduct();
        var material = fixtures.insertMaterial(owner, productId, "Bell material");
        Instant older = Instant.now().minus(2, ChronoUnit.HOURS);
        Instant newer = Instant.now().minus(1, ChronoUnit.HOURS);
        UUID unreadId = fixtures.insertNotification(owner, material.materialId(), other, "comment_added", newer, null);
        fixtures.insertNotification(owner, material.materialId(), other, "approved", older, older);

        ResponseEntity<String> list = restTemplate.exchange(
                "/api/notifications", HttpMethod.GET, new HttpEntity<>(authHeaders(owner)), String.class);
        JsonNode feed = objectMapper.readTree(list.getBody());
        assertThat(feed.get("unreadCount").asInt()).isEqualTo(1);
        assertThat(feed.get("items")).hasSize(2);
        assertThat(feed.get("items").get(0).get("id").asText()).isEqualTo(unreadId.toString());
        assertThat(feed.get("items").get(0).get("read").asBoolean()).isFalse();

        ResponseEntity<String> read = restTemplate.exchange(
                "/api/notifications/" + unreadId + "/read",
                HttpMethod.POST,
                new HttpEntity<>(authHeaders(owner)),
                String.class);
        assertThat(read.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(read.getBody()).get("read").asBoolean()).isTrue();

        restTemplate.exchange(
                "/api/notifications/" + unreadId + "/read",
                HttpMethod.POST,
                new HttpEntity<>(authHeaders(owner)),
                String.class);

        ResponseEntity<String> forbidden = restTemplate.exchange(
                "/api/notifications/" + unreadId + "/read",
                HttpMethod.POST,
                new HttpEntity<>(authHeaders(other)),
                String.class);
        assertThat(forbidden.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void readAllDoesNotChangeTasks() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewer = fixtures.insertUser("Reviewer");
        UUID groupId = fixtures.insertGroup("Legal");
        fixtures.addMembership(reviewer, groupId);
        UUID productId = fixtures.insertProduct();
        var material = fixtures.insertMaterial(owner, productId, "Task material");
        UUID cycleId = fixtures.insertActiveCycle(material.materialId(), material.versionId(), owner);
        UUID stepId = fixtures.insertCycleStep(cycleId, 1, "Legal");
        fixtures.insertCycleRequirement(stepId, groupId, "Legal", 1);
        fixtures.insertNotification(reviewer, material.materialId(), owner, "step_opened", Instant.now(), null);

        HttpHeaders reviewerHeaders = authHeaders(reviewer);
        ResponseEntity<String> tasksBefore = restTemplate.exchange(
                "/api/tasks?tab=mine", HttpMethod.GET, new HttpEntity<>(reviewerHeaders), String.class);
        assertThat(tasksBefore.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode before = objectMapper.readTree(tasksBefore.getBody());
        assertThat(before).hasSize(1);

        restTemplate.exchange(
                "/api/notifications/read-all", HttpMethod.POST, new HttpEntity<>(reviewerHeaders), Void.class);

        ResponseEntity<String> tasksAfter = restTemplate.exchange(
                "/api/tasks?tab=mine", HttpMethod.GET, new HttpEntity<>(reviewerHeaders), String.class);
        assertThat(objectMapper.readTree(tasksAfter.getBody())).isEqualTo(before);

        ResponseEntity<String> feed = restTemplate.exchange(
                "/api/notifications", HttpMethod.GET, new HttpEntity<>(reviewerHeaders), String.class);
        assertThat(objectMapper.readTree(feed.getBody()).get("unreadCount").asInt()).isZero();
    }

    @Test
    void lazyExpiryCreatesSingleNotificationUnderConcurrency() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID viewer = fixtures.insertUser("Viewer");
        UUID productId = fixtures.insertProduct();
        fixtures.insertExpiredMaterial(
                owner, productId, "Expired once", Instant.now().minus(1, ChronoUnit.DAYS));
        fixtures.insertFutureApprovedMaterial(owner, productId, "Still valid");
        var obsolete = fixtures.insertExpiredMaterial(
                owner, productId, "Obsolete expired", Instant.now().minus(2, ChronoUnit.DAYS));
        fixtures.markObsolete(obsolete.materialId());

        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Callable<ResponseEntity<String>>> jobs = new ArrayList<>();
            for (int i = 0; i < 16; i++) {
                jobs.add(() -> restTemplate.exchange(
                        "/api/materials",
                        HttpMethod.GET,
                        new HttpEntity<>(authHeaders(viewer)),
                        String.class));
            }
            List<Future<ResponseEntity<String>>> results = pool.invokeAll(jobs);
            for (Future<ResponseEntity<String>> result : results) {
                assertThat(result.get().getStatusCode()).isEqualTo(HttpStatus.OK);
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(fixtures.countNotifications(owner, "material_expired")).isEqualTo(1);
        long expiredActivities =
                jdbcTemplate.queryForObject("SELECT COUNT(*) FROM activity WHERE type = 'expired'", Long.class);
        assertThat(expiredActivities).isEqualTo(1);
    }

    @Test
    void lazyExpiryViaMaterialDetailAndObsoleteCommentRejected() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewer = fixtures.insertUser("Reviewer");
        UUID productId = fixtures.insertProduct();
        var expired = fixtures.insertExpiredMaterial(
                owner, productId, "Detail expiry", Instant.now().minus(1, ChronoUnit.HOURS));

        restTemplate.exchange(
                "/api/materials/" + expired.materialId(),
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(owner)),
                String.class);
        assertThat(fixtures.countNotifications(owner, "material_expired")).isEqualTo(1);

        fixtures.markObsolete(expired.materialId());
        ResponseEntity<String> comment = restTemplate.exchange(
                "/api/versions/" + expired.versionId() + "/comments",
                HttpMethod.POST,
                jsonEntity(authHeaders(reviewer), "{\"body\":\"Too late\"}"),
                String.class);
        assertThat(comment.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(comment.getBody()).contains("MATERIAL_OBSOLETE");
    }

    @Test
    void unauthorizedRequestsAreRejected() {
        ResponseEntity<String> notifications = restTemplate.getForEntity("/api/notifications", String.class);
        assertThat(notifications.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpHeaders authHeaders(UUID userId) {
        String token = sessionTokenService.sign(userId, Instant.now().plus(1, ChronoUnit.HOURS));
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionProperties.cookieName() + "=" + token);
        return headers;
    }

    private static HttpEntity<String> jsonEntity(HttpHeaders headers, String body) {
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    @TestConfiguration
    static class TestAuthConfig {

        @Bean
        @Primary
        CurrentUserLoader socialTestCurrentUserLoader(AppUserRepository users, MembershipRepository memberships) {
            return userId -> {
                AppUser user = users.findById(userId).orElseThrow();
                List<UUID> groupIds = memberships.findByIdUserId(userId).stream()
                        .map(membership -> membership.getId().getGroupId())
                        .toList();
                return new CurrentUser(user.getId(), user.getName(), user.getEmail(), groupIds);
            };
        }
    }
}
