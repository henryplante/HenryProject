package com.clearpath.review.web.tasks;

import static org.assertj.core.api.Assertions.assertThat;

import com.clearpath.review.auth.CurrentUserLoader;
import com.clearpath.review.auth.SessionTokenService;
import com.clearpath.review.service.tasks.TaskCounts;
import com.clearpath.review.service.tasks.TaskRow;
import com.clearpath.review.service.tasks.TaskTab;
import com.clearpath.review.support.AbstractPostgresIT;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
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
import org.springframework.jdbc.core.JdbcTemplate;

@Import(TaskControllerIT.AuthConfig.class)
class TaskControllerIT extends AbstractPostgresIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private SessionTokenService sessionTokenService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private TaskFixtures fixtures;

    @BeforeEach
    void setUpFixtures() {
        fixtures = new TaskFixtures(jdbcTemplate);
    }

    @Test
    void mine_showsRowWhileGroupQuotaShort_andDropsWhenMet() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewerA = fixtures.insertUser("Reviewer A");
        UUID reviewerB = fixtures.insertUser("Reviewer B");
        UUID groupId = fixtures.insertGroup("Legal");
        fixtures.addMembership(reviewerA, groupId);
        fixtures.addMembership(reviewerB, groupId);

        UUID productId = fixtures.insertProduct("Loan");
        var material = fixtures.insertMaterial(owner, productId, "Quota material");
        UUID cycleId = fixtures.insertActiveCycle(material.materialId(), material.versionId(), owner, 1);
        UUID stepId = fixtures.insertCycleStep(cycleId, 1, "Legal", Instant.now());
        fixtures.insertCycleRequirement(stepId, groupId, "Legal", 2);

        assertMineContains(reviewerA, material.materialId());
        assertMineContains(reviewerB, material.materialId());

        fixtures.insertReview(cycleId, 1, groupId, reviewerA, true, Instant.now());

        assertMineEmpty(reviewerA);
        assertMineContains(reviewerB, material.materialId());

        fixtures.insertReview(cycleId, 1, groupId, reviewerB, true, Instant.now());
        assertMineEmpty(reviewerB);
    }

    @Test
    void mine_hidesRowWhenUserAlreadyApproved() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewer = fixtures.insertUser("Reviewer");
        UUID groupId = fixtures.insertGroup("Compliance");
        fixtures.addMembership(reviewer, groupId);

        UUID productId = fixtures.insertProduct("Card");
        var material = fixtures.insertMaterial(owner, productId, "Already approved");
        UUID cycleId = fixtures.insertActiveCycle(material.materialId(), material.versionId(), owner, 1);
        UUID stepId = fixtures.insertCycleStep(cycleId, 1, "Compliance", Instant.now());
        fixtures.insertCycleRequirement(stepId, groupId, "Compliance", 2);
        fixtures.insertReview(cycleId, 1, groupId, reviewer, true, Instant.now());

        assertMineEmpty(reviewer);
    }

    @Test
    void mine_singleRowWhenEligibleViaTwoGroups() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewer = fixtures.insertUser("Dual");
        UUID groupA = fixtures.insertGroup("G1");
        UUID groupB = fixtures.insertGroup("G2");
        fixtures.addMembership(reviewer, groupA);
        fixtures.addMembership(reviewer, groupB);

        UUID productId = fixtures.insertProduct("Dual");
        var material = fixtures.insertMaterial(owner, productId, "Dual group");
        UUID cycleId = fixtures.insertActiveCycle(material.materialId(), material.versionId(), owner, 1);
        UUID stepId = fixtures.insertCycleStep(cycleId, 1, "Legal", Instant.now());
        fixtures.insertCycleRequirement(stepId, groupA, "G1", 1);
        fixtures.insertCycleRequirement(stepId, groupB, "G2", 1);

        List<TaskRow> rows = fetchMine(reviewer);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().materialId()).isEqualTo(material.materialId());
    }

    @Test
    void upcoming_forFutureStepMember_notForCurrentStepEligibleUser() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID stepOneReviewer = fixtures.insertUser("Step1");
        UUID stepTwoReviewer = fixtures.insertUser("Step2");
        UUID groupOne = fixtures.insertGroup("Step1Group");
        UUID groupTwo = fixtures.insertGroup("Step2Group");
        fixtures.addMembership(stepOneReviewer, groupOne);
        fixtures.addMembership(stepTwoReviewer, groupTwo);

        UUID productId = fixtures.insertProduct("Two-step");
        var material = fixtures.insertMaterial(owner, productId, "Future step");
        UUID cycleId = fixtures.insertActiveCycle(material.materialId(), material.versionId(), owner, 1);
        UUID step1 = fixtures.insertCycleStep(cycleId, 1, "Legal", Instant.now());
        fixtures.insertCycleStep(cycleId, 2, "Compliance", null);
        fixtures.insertCycleRequirement(step1, groupOne, "Step1Group", 1);
        UUID step2Id = jdbcTemplate.queryForObject(
                "SELECT id FROM cycle_step WHERE cycle_id = ? AND position = 2", UUID.class, cycleId);
        fixtures.insertCycleRequirement(step2Id, groupTwo, "Step2Group", 1);

        assertThat(fetchUpcoming(stepTwoReviewer)).extracting(TaskRow::materialId).contains(material.materialId());
        assertThat(fetchUpcoming(stepOneReviewer)).isEmpty();
        assertMineContains(stepOneReviewer, material.materialId());
    }

    @Test
    void workflows_includesDraftAndInReview_excludesOtherStatuses() throws Exception {
        UUID owner = fixtures.insertUser("Workflow owner");
        UUID otherOwner = fixtures.insertUser("Other");
        UUID productId = fixtures.insertProduct("WF product");

        var draft = fixtures.insertMaterial(owner, productId, "Draft owned");
        var inReview = fixtures.insertMaterial(owner, productId, "In review owned");
        UUID cycleId = fixtures.insertActiveCycle(inReview.materialId(), inReview.versionId(), owner, 1);
        UUID stepId = fixtures.insertCycleStep(cycleId, 1, "Brand", Instant.now());
        UUID groupId = fixtures.insertGroup("Brand");
        fixtures.insertCycleRequirement(stepId, groupId, "Brand", 1);

        var approved = fixtures.insertMaterial(owner, productId, "Approved owned");
        fixtures.setMaterialApproved(approved.materialId(), approved.versionId(), Instant.now().plus(30, ChronoUnit.DAYS));

        var expired = fixtures.insertMaterial(owner, productId, "Expired owned");
        fixtures.setMaterialApproved(expired.materialId(), expired.versionId(), Instant.now().minus(1, ChronoUnit.DAYS));

        var obsolete = fixtures.insertMaterial(owner, productId, "Obsolete owned");
        fixtures.setMaterialObsolete(obsolete.materialId());

        var notOwned = fixtures.insertMaterial(otherOwner, productId, "Not mine");

        List<TaskRow> workflows = fetchWorkflows(owner);
        assertThat(workflows).extracting(TaskRow::materialId).contains(draft.materialId(), inReview.materialId());
        assertThat(workflows).extracting(TaskRow::materialId)
                .doesNotContain(
                        approved.materialId(),
                        expired.materialId(),
                        obsolete.materialId(),
                        notOwned.materialId());

        TaskRow draftRow = workflows.stream()
                .filter(r -> r.materialId().equals(draft.materialId()))
                .findFirst()
                .orElseThrow();
        assertThat(draftRow.stepName()).isEqualTo("Not submitted");

        TaskRow reviewRow = workflows.stream()
                .filter(r -> r.materialId().equals(inReview.materialId()))
                .findFirst()
                .orElseThrow();
        assertThat(reviewRow.stepName()).isEqualTo("Brand");
    }

    @Test
    void overdue_boundaryThreeDaysVersusFour() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewer = fixtures.insertUser("Reviewer");
        UUID groupId = fixtures.insertGroup("Overdue");
        fixtures.addMembership(reviewer, groupId);
        UUID productId = fixtures.insertProduct("Overdue product");

        var threeDay = fixtures.insertMaterial(owner, productId, "Three days");
        UUID cycle3 = fixtures.insertActiveCycle(threeDay.materialId(), threeDay.versionId(), owner, 1);
        UUID step3 = fixtures.insertCycleStep(cycle3, 1, "Legal", daysAgo(3));
        fixtures.insertCycleRequirement(step3, groupId, "Overdue", 1);

        var fourDay = fixtures.insertMaterial(owner, productId, "Four days");
        UUID cycle4 = fixtures.insertActiveCycle(fourDay.materialId(), fourDay.versionId(), owner, 1);
        UUID step4 = fixtures.insertCycleStep(cycle4, 1, "Legal", daysAgo(4));
        fixtures.insertCycleRequirement(step4, groupId, "Overdue", 1);

        List<TaskRow> rows = fetchMine(reviewer);
        TaskRow three = rows.stream()
                .filter(r -> r.materialId().equals(threeDay.materialId()))
                .findFirst()
                .orElseThrow();
        TaskRow four = rows.stream()
                .filter(r -> r.materialId().equals(fourDay.materialId()))
                .findFirst()
                .orElseThrow();

        assertThat(three.daysWaiting()).isEqualTo(3);
        assertThat(three.overdue()).isFalse();
        assertThat(four.daysWaiting()).isEqualTo(4);
        assertThat(four.overdue()).isTrue();
    }

    @Test
    void abandonedCycleProducesNoTaskRows() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID reviewer = fixtures.insertUser("Reviewer");
        UUID groupId = fixtures.insertGroup("Abandoned");
        fixtures.addMembership(reviewer, groupId);
        UUID productId = fixtures.insertProduct("Abandoned product");
        var material = fixtures.insertMaterial(owner, productId, "Abandoned");
        UUID cycleId = fixtures.insertAbandonedCycle(material.materialId(), material.versionId(), owner);
        UUID stepId = fixtures.insertCycleStep(cycleId, 1, "Legal", Instant.now());
        fixtures.insertCycleRequirement(stepId, groupId, "Abandoned", 1);

        assertMineEmpty(reviewer);
        assertThat(fetchUpcoming(reviewer)).isEmpty();
    }

    @Test
    void countsMatchListSizes() throws Exception {
        UUID owner = fixtures.insertUser("Owner");
        UUID groupId = fixtures.insertGroup("Counts");
        fixtures.addMembership(owner, groupId);
        UUID productId = fixtures.insertProduct("Counts product");

        var mineMaterial = fixtures.insertMaterial(owner, productId, "Mine row");
        UUID cycleId = fixtures.insertActiveCycle(mineMaterial.materialId(), mineMaterial.versionId(), owner, 1);
        UUID stepId = fixtures.insertCycleStep(cycleId, 1, "Legal", Instant.now());
        fixtures.insertCycleRequirement(stepId, groupId, "Counts", 1);

        fixtures.insertMaterial(owner, productId, "Workflow draft");

        TaskCounts counts = fetchCounts(owner);
        assertThat(counts.mine()).isEqualTo(fetchMine(owner).size());
        assertThat(counts.workflows()).isEqualTo(fetchWorkflows(owner).size());
        assertThat(counts.upcoming()).isEqualTo(fetchUpcoming(owner).size());
    }

    @Test
    void unauthorizedWithoutSessionCookie() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/tasks?tab=mine", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void invalidTabReturnsBadRequest() {
        UUID userId = fixtures.insertUser("Tab user");
        ResponseEntity<String> response = exchange(userId, "/api/tasks?tab=invalid", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private void assertMineContains(UUID userId, UUID materialId) throws Exception {
        assertThat(fetchMine(userId)).extracting(TaskRow::materialId).contains(materialId);
    }

    private void assertMineEmpty(UUID userId) throws Exception {
        assertThat(fetchMine(userId)).isEmpty();
    }

    private List<TaskRow> fetchMine(UUID userId) throws Exception {
        return fetchTasks(userId, TaskTab.mine);
    }

    private List<TaskRow> fetchWorkflows(UUID userId) throws Exception {
        return fetchTasks(userId, TaskTab.workflows);
    }

    private List<TaskRow> fetchUpcoming(UUID userId) throws Exception {
        return fetchTasks(userId, TaskTab.upcoming);
    }

    private List<TaskRow> fetchTasks(UUID userId, TaskTab tab) throws Exception {
        ResponseEntity<String> response = exchange(userId, "/api/tasks?tab=" + tab.name(), String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readValue(response.getBody(), new TypeReference<>() {});
    }

    private TaskCounts fetchCounts(UUID userId) throws Exception {
        ResponseEntity<String> response = exchange(userId, "/api/tasks/counts", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readValue(response.getBody(), TaskCounts.class);
    }

    private <T> ResponseEntity<T> exchange(UUID userId, String path, Class<T> type) {
        HttpHeaders headers = new HttpHeaders();
        String token = sessionTokenService.sign(userId, Instant.now().plus(1, ChronoUnit.HOURS));
        headers.add(HttpHeaders.COOKIE, "clearpath_session=" + token);
        return restTemplate.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), type);
    }

    private static Instant daysAgo(int days) {
        LocalDate date = LocalDate.now(ZoneOffset.UTC).minusDays(days);
        return date.atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    @TestConfiguration
    static class AuthConfig {

        @Bean
        @Primary
        CurrentUserLoader testTasksCurrentUserLoader(JdbcTemplate jdbcTemplate) {
            return new DbCurrentUserLoader(jdbcTemplate);
        }
    }
}
