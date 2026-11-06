package com.clearpath.review.web.materials;

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
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
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
import org.springframework.http.ResponseEntity;

@Import(MaterialReadControllerIT.TestAuthConfig.class)
class MaterialReadControllerIT extends AbstractPostgresIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionTokenService sessionTokenService;

    @Autowired
    private SessionProperties sessionProperties;

    @Autowired
    private MaterialFixtures materialFixtures;

    @Autowired
    private DataSource dataSource;

    private MaterialFixtures.Scenario scenario;

    @BeforeEach
    void resetData() throws Exception {
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute(
                    """
                    TRUNCATE notification, favorite, activity, comment, review, cycle_requirement, cycle_step,
                    review_cycle, material_version, material, file_blob, step_requirement, workflow_step, product,
                    membership, user_group, app_user RESTART IDENTITY CASCADE
                    """);
        }
        scenario = materialFixtures.seedWalkthroughScenario();
    }

    @Test
    void listMaterialsSupportsFiltersSearchAndFavorites() throws Exception {
        HttpHeaders headers = authHeaders(scenario.dualReviewerId());

        ResponseEntity<String> all = restTemplate.exchange(
                "/api/materials", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(all.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode items = objectMapper.readTree(all.getBody());
        assertThat(items).hasSize(2);

        ResponseEntity<String> search = restTemplate.exchange(
                "/api/materials?q=walkthrough", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        JsonNode searchItems = objectMapper.readTree(search.getBody());
        assertThat(searchItems).hasSize(1);
        assertThat(searchItems.get(0).get("title").asText()).isEqualTo("Walkthrough Banner");

        ResponseEntity<String> favorites = restTemplate.exchange(
                "/api/materials?favorites=true", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        JsonNode favoriteItems = objectMapper.readTree(favorites.getBody());
        assertThat(favoriteItems).hasSize(1);
        assertThat(favoriteItems.get(0).get("favorited").asBoolean()).isTrue();

        ResponseEntity<String> owned = restTemplate.exchange(
                "/api/materials?owned=true", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(objectMapper.readTree(owned.getBody())).isEmpty();

        HttpHeaders ownerHeaders = authHeaders(scenario.ownerId());
        ResponseEntity<String> ownerOwned = restTemplate.exchange(
                "/api/materials?owned=true", HttpMethod.GET, new HttpEntity<>(ownerHeaders), String.class);
        assertThat(objectMapper.readTree(ownerOwned.getBody())).hasSize(1);

        ResponseEntity<String> inReview = restTemplate.exchange(
                "/api/materials?status=in_review", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(objectMapper.readTree(inReview.getBody())).hasSize(1);
        assertThat(objectMapper.readTree(inReview.getBody()).get(0).get("status").asText())
                .isEqualTo("in_review");
    }

    @Test
    void getMaterialIncludesPerVersionStatusesCycleAndCapabilities() throws Exception {
        HttpHeaders headers = authHeaders(scenario.dualReviewerId());

        ResponseEntity<String> detailResponse = restTemplate.exchange(
                "/api/materials/" + scenario.materialId(),
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);
        assertThat(detailResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode detail = objectMapper.readTree(detailResponse.getBody());

        assertThat(detail.get("status").asText()).isEqualTo("in_review");
        assertThat(detail.get("currentVersionNumber").asInt()).isEqualTo(3);
        assertThat(detail.get("selectedVersionId").asText()).isEqualTo(scenario.v3Id().toString());

        JsonNode versions = detail.get("versions");
        assertThat(versions).hasSize(3);
        assertVersionStatus(versions, 1, "approved");
        assertVersionStatus(versions, 2, "draft");
        assertVersionStatus(versions, 3, "in_review");

        JsonNode cycle = detail.get("cycle");
        assertThat(cycle.get("status").asText()).isEqualTo("active");
        JsonNode requirements = cycle.get("steps").get(0).get("requirements");
        JsonNode legalReq = findRequirement(requirements, scenario.legalId());
        assertThat(legalReq.get("have").asInt()).isEqualTo(1);
        assertThat(legalReq.get("need").asInt()).isEqualTo(2);

        JsonNode capabilities = detail.get("capabilities");
        assertThat(capabilities.get("canStartReview").asBoolean()).isFalse();
        assertThat(capabilities.get("canApprove").asBoolean()).isTrue();
        assertThat(capabilities.get("approvableGroups")).hasSize(2);

        ResponseEntity<String> v1Detail = restTemplate.exchange(
                "/api/materials/" + scenario.materialId() + "?versionId=" + scenario.v1Id(),
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);
        JsonNode v1Body = objectMapper.readTree(v1Detail.getBody());
        assertThat(v1Body.get("selectedVersionId").asText()).isEqualTo(scenario.v1Id().toString());
        assertThat(v1Body.get("cycle").get("status").asText()).isEqualTo("completed");
        assertThat(v1Body.get("capabilities").get("canStartReview").asBoolean()).isFalse();
    }

    @Test
    void versionFileCommentsAndActivityEndpointsWork() {
        HttpHeaders headers = authHeaders(scenario.dualReviewerId());

        ResponseEntity<byte[]> fileResponse = restTemplate.exchange(
                "/api/versions/" + scenario.v3Id() + "/file",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                byte[].class);
        assertThat(fileResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fileResponse.getHeaders().getContentType().toString()).contains("application/pdf");
        assertThat(fileResponse.getHeaders().getContentLength()).isEqualTo(MaterialFixtures.PDF_BYTES.length);
        assertThat(fileResponse.getBody()).isEqualTo(MaterialFixtures.PDF_BYTES);

        ResponseEntity<String> comments = restTemplate.exchange(
                "/api/versions/" + scenario.v3Id() + "/comments",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);
        assertThat(comments.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> activity = restTemplate.exchange(
                "/api/materials/" + scenario.materialId() + "/activity",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);
        assertThat(activity.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void missingResourcesAndAuthAreRejected() {
        HttpHeaders headers = authHeaders(scenario.ownerId());

        ResponseEntity<String> missingMaterial = restTemplate.exchange(
                "/api/materials/" + UUID.randomUUID(), HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(missingMaterial.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        ResponseEntity<String> missingVersion = restTemplate.exchange(
                "/api/versions/" + UUID.randomUUID() + "/file",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);
        assertThat(missingVersion.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        ResponseEntity<String> unauthorized = restTemplate.getForEntity("/api/materials", String.class);
        assertThat(unauthorized.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private HttpHeaders authHeaders(UUID userId) {
        String token = sessionTokenService.sign(userId, Instant.now().plus(1, ChronoUnit.HOURS));
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionProperties.cookieName() + "=" + token);
        return headers;
    }

    private static void assertVersionStatus(JsonNode versions, int number, String expectedStatus) {
        for (JsonNode version : versions) {
            if (version.get("number").asInt() == number) {
                assertThat(version.get("versionStatus").asText()).isEqualTo(expectedStatus);
                return;
            }
        }
        throw new AssertionError("Missing version number " + number);
    }

    private static JsonNode findRequirement(JsonNode requirements, UUID groupId) {
        for (JsonNode requirement : requirements) {
            if (requirement.get("groupId").asText().equals(groupId.toString())) {
                return requirement;
            }
        }
        throw new AssertionError("Missing requirement for group " + groupId);
    }

    @TestConfiguration
    static class TestAuthConfig {

        @Bean
        @Primary
        CurrentUserLoader dbCurrentUserLoader(AppUserRepository users, MembershipRepository memberships) {
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
