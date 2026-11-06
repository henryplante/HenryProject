package com.clearpath.review.review;

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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

@Import(ReviewEngineIT.TestAuthConfig.class)
class ReviewEngineIT extends AbstractPostgresIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionTokenService sessionTokenService;

    @Autowired
    private SessionProperties sessionProperties;

    @Autowired
    private ReviewFixtures fixtures;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

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
    }

    @Test
    void legalQuorumAdvancesStep() throws Exception {
        ReviewFixtures.DraftMaterial material = fixtures.seedDraftTwoStepLegalQuorum();
        startReview(material.materialId(), material.ownerId());

        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.OK);
        JsonNode afterOne = getDetail(material.materialId(), material.ownerId());
        assertRequirementCount(afterOne, material.group1Id(), 1, 2);
        assertThat(afterOne.get("cycle").get("currentPosition").asInt()).isEqualTo(1);

        approve(material.materialId(), material.group1Id(), material.reviewer2Id(), HttpStatus.OK);
        JsonNode afterTwo = getDetail(material.materialId(), material.ownerId());
        assertThat(afterTwo.get("cycle").get("currentPosition").asInt()).isEqualTo(2);
        assertRequirementCount(afterTwo, material.group1Id(), 2, 2);
    }

    @Test
    void creditCardParallelGroupsRequiredBeforeStepTwo() throws Exception {
        ReviewFixtures.CreditCardScenario card = fixtures.seedCreditCardParallelStep();
        startReview(card.materialId(), card.ownerId());

        approve(card.materialId(), card.legalGroupId(), card.legalUserId(), HttpStatus.OK);
        JsonNode mid = getDetail(card.materialId(), card.ownerId());
        assertThat(mid.get("cycle").get("currentPosition").asInt()).isEqualTo(1);

        approve(card.materialId(), card.complianceGroupId(), card.complianceUserId(), HttpStatus.OK);
        JsonNode stepTwo = getDetail(card.materialId(), card.ownerId());
        assertThat(stepTwo.get("cycle").get("currentPosition").asInt()).isEqualTo(2);
    }

    @Test
    void additionalApprovalAfterQuotaIsNotCounted() throws Exception {
        ReviewFixtures.DraftMaterial material = fixtures.seedLegalQuorumWithParallelMarketing();
        startReview(material.materialId(), material.ownerId());
        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.OK);
        approve(material.materialId(), material.group1Id(), material.reviewer2Id(), HttpStatus.OK);

        UUID cycleId = fixtures.findActiveCycleId(material.materialId());
        assertThat(fixtures.countReviews(cycleId, 1, material.group1Id(), true)).isEqualTo(2);
        assertThat(getDetail(material.materialId(), material.ownerId()).get("cycle").get("currentPosition").asInt())
                .isEqualTo(1);

        approve(material.materialId(), material.group1Id(), material.reviewer3Id(), HttpStatus.OK);
        assertThat(fixtures.countReviews(cycleId, 1, material.group1Id(), false)).isEqualTo(1);
    }

    @Test
    void dualGroupMemberApprovesOneGroupPerCall() throws Exception {
        ReviewFixtures.DraftMaterial material = fixtures.seedDualGroupReviewer();
        startReview(material.materialId(), material.ownerId());

        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.OK);
        JsonNode detail = getDetail(material.materialId(), material.ownerId());
        assertRequirementCount(detail, material.group1Id(), 1, 1);
        assertRequirementCount(detail, material.group2Id(), 0, 1);

        approve(material.materialId(), material.group2Id(), material.reviewer1Id(), HttpStatus.OK);
        JsonNode done = getDetail(material.materialId(), material.ownerId());
        assertThat(done.get("cycle").get("status").asText()).isEqualTo("completed");
    }

    @Test
    void duplicateApproveReturns409() {
        ReviewFixtures.DraftMaterial material = fixtures.seedDraftTwoStepLegalQuorum();
        startReview(material.materialId(), material.ownerId());
        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.OK);
        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.CONFLICT);
    }

    @Test
    void nonMemberApproveReturns403() {
        ReviewFixtures.DraftMaterial material = fixtures.seedDraftTwoStepLegalQuorum();
        startReview(material.materialId(), material.ownerId());
        approve(material.materialId(), material.group1Id(), material.reviewer3Id(), HttpStatus.FORBIDDEN);
    }

    @Test
    void approveWithoutCycleReturns409() {
        ReviewFixtures.DraftMaterial material = fixtures.seedDraftTwoStepLegalQuorum();
        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.CONFLICT);
    }

    @Test
    void completingLastStepSetsApprovedVersionAndUntilFromSnapshot() throws Exception {
        ReviewFixtures.DraftMaterial material = fixtures.seedDualGroupReviewer();
        Instant before = Instant.now();
        startReview(material.materialId(), material.ownerId());
        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.OK);
        approve(material.materialId(), material.group2Id(), material.reviewer1Id(), HttpStatus.OK);

        JsonNode detail = getDetail(material.materialId(), material.ownerId());
        assertThat(detail.get("status").asText()).isEqualTo("approved");
        assertThat(detail.get("approvedUntil").asText()).isNotBlank();

        UUID approvedVersionId = jdbcTemplate.queryForObject(
                "SELECT approved_version_id FROM material WHERE id = ?", UUID.class, material.materialId());
        assertThat(approvedVersionId).isEqualTo(material.versionId());

        Instant approvedUntil = Instant.parse(detail.get("approvedUntil").asText());
        assertThat(approvedUntil).isAfter(before.plus(material.approvalLifetimeDays(), ChronoUnit.DAYS).minus(1, ChronoUnit.DAYS));
    }

    @Test
    void groupTooSmallNamesGroup() throws Exception {
        ReviewFixtures.DraftMaterial material = fixtures.seedGroupTooSmallOnLaterStep();
        ResponseEntity<String> response = postStart(material.materialId(), material.ownerId());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        JsonNode error = objectMapper.readTree(response.getBody()).get("error");
        assertThat(error.get("code").asText()).isEqualTo("GROUP_TOO_SMALL");
        assertThat(error.get("details").get("groupName").asText()).isEqualTo("Compliance");
    }

    @Test
    void startOnObsoleteMaterialReturns409() {
        ReviewFixtures.DraftMaterial material = fixtures.seedObsoleteMaterial();
        postStartExpect(material.materialId(), material.ownerId(), HttpStatus.CONFLICT);
    }

    @Test
    void startReviewWritesBellNotificationsForStepOneGroups() {
        ReviewFixtures.DraftMaterial material = fixtures.seedDraftTwoStepLegalQuorum();
        startReview(material.materialId(), material.ownerId());
        assertThat(fixtures.countNotifications(material.reviewer1Id(), "step_opened")).isEqualTo(1);
        assertThat(fixtures.countNotifications(material.reviewer2Id(), "step_opened")).isEqualTo(1);
        assertThat(fixtures.countNotifications(material.reviewer3Id(), "step_opened")).isZero();
    }

    @Test
    void approvalNotifiesOwnerAndRecordsActivity() {
        ReviewFixtures.DraftMaterial material = fixtures.seedDraftTwoStepLegalQuorum();
        startReview(material.materialId(), material.ownerId());
        approve(material.materialId(), material.group1Id(), material.reviewer1Id(), HttpStatus.OK);
        assertThat(fixtures.countNotifications(material.ownerId(), "approved")).isEqualTo(1);
        Integer activityCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM activity WHERE material_id = ? AND type = 'approved'",
                Integer.class,
                material.materialId());
        assertThat(activityCount).isEqualTo(1);
    }

    @Test
    void parallelApprovalsDoNotDoubleAdvanceStep() throws Exception {
        ReviewFixtures.DraftMaterial material = fixtures.seedDraftTwoStepLegalQuorum();
        startReview(material.materialId(), material.ownerId());

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger okCount = new AtomicInteger();
        AtomicInteger conflictCount = new AtomicInteger();

        Runnable task1 = () -> runParallelApprove(material, material.reviewer1Id(), ready, go, okCount, conflictCount);
        Runnable task2 = () -> runParallelApprove(material, material.reviewer2Id(), ready, go, okCount, conflictCount);

        Thread t1 = new Thread(task1);
        Thread t2 = new Thread(task2);
        t1.start();
        t2.start();
        assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
        go.countDown();
        t1.join(10_000);
        t2.join(10_000);

        assertThat(okCount.get()).isEqualTo(2);
        JsonNode detail = getDetail(material.materialId(), material.ownerId());
        assertThat(detail.get("cycle").get("currentPosition").asInt()).isEqualTo(2);
        UUID cycleId = fixtures.findActiveCycleId(material.materialId());
        assertThat(fixtures.countReviews(cycleId, 1, material.group1Id(), true)).isEqualTo(2);
    }

    private void runParallelApprove(
            ReviewFixtures.DraftMaterial material,
            UUID userId,
            CountDownLatch ready,
            CountDownLatch go,
            AtomicInteger okCount,
            AtomicInteger conflictCount) {
        ready.countDown();
        try {
            go.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }
        ResponseEntity<String> response = postApprove(material.materialId(), material.group1Id(), userId);
        if (response.getStatusCode() == HttpStatus.OK) {
            okCount.incrementAndGet();
        } else if (response.getStatusCode() == HttpStatus.CONFLICT) {
            conflictCount.incrementAndGet();
        }
    }

    private void startReview(UUID materialId, UUID userId) {
        postStartExpect(materialId, userId, HttpStatus.OK);
    }

    private void postStartExpect(UUID materialId, UUID userId, HttpStatus expected) {
        ResponseEntity<String> response = postStart(materialId, userId);
        assertThat(response.getStatusCode()).isEqualTo(expected);
    }

    private ResponseEntity<String> postStart(UUID materialId, UUID userId) {
        return restTemplate.exchange(
                "/api/materials/" + materialId + "/review/start",
                HttpMethod.POST,
                new HttpEntity<>(authHeaders(userId)),
                String.class);
    }

    private void approve(UUID materialId, UUID groupId, UUID userId, HttpStatus expected) {
        ResponseEntity<String> response = postApprove(materialId, groupId, userId);
        assertThat(response.getStatusCode()).isEqualTo(expected);
    }

    private ResponseEntity<String> postApprove(UUID materialId, UUID groupId, UUID userId) {
        HttpHeaders headers = authHeaders(userId);
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"groupId\": \"" + groupId + "\"}";
        return restTemplate.exchange(
                "/api/materials/" + materialId + "/approvals",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class);
    }

    private JsonNode getDetail(UUID materialId, UUID userId) throws Exception {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/materials/" + materialId,
                HttpMethod.GET,
                new HttpEntity<>(authHeaders(userId)),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(response.getBody());
    }

    private HttpHeaders authHeaders(UUID userId) {
        String token = sessionTokenService.sign(userId, Instant.now().plus(1, ChronoUnit.HOURS));
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionProperties.cookieName() + "=" + token);
        return headers;
    }

    private static void assertRequirementCount(JsonNode detail, UUID groupId, int have, int need) {
        JsonNode steps = detail.get("cycle").get("steps");
        for (JsonNode step : steps) {
            if (!"active".equals(step.get("state").asText()) && !"completed".equals(step.get("state").asText())) {
                continue;
            }
            for (JsonNode requirement : step.get("requirements")) {
                if (requirement.get("groupId").asText().equals(groupId.toString())) {
                    assertThat(requirement.get("have").asInt()).isEqualTo(have);
                    assertThat(requirement.get("need").asInt()).isEqualTo(need);
                    return;
                }
            }
        }
        for (JsonNode step : steps) {
            for (JsonNode requirement : step.get("requirements")) {
                if (requirement.get("groupId").asText().equals(groupId.toString())) {
                    assertThat(requirement.get("have").asInt()).isEqualTo(have);
                    assertThat(requirement.get("need").asInt()).isEqualTo(need);
                    return;
                }
            }
        }
        throw new AssertionError("Requirement not found for group " + groupId);
    }

    @TestConfiguration
    static class TestAuthConfig {

        @Bean
        @Primary
        CurrentUserLoader testReviewCurrentUserLoader(AppUserRepository users, MembershipRepository memberships) {
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
