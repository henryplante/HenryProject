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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

@Import(MaterialWriteControllerIT.TestAuthConfig.class)
class MaterialWriteControllerIT extends AbstractPostgresIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionTokenService sessionTokenService;

    @Autowired
    private SessionProperties sessionProperties;

    @Autowired
    private MaterialWriteFixtures fixtures;

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
    void createWithoutStartReviewLeavesDraft() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Draft Product", 1);
        ResponseEntity<String> response = postCreate(setup, false);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = objectMapper.readTree(response.getBody());
        assertThat(body.get("status").asText()).isEqualTo("draft");
        assertThat(body.get("currentVersionNumber").asInt()).isEqualTo(1);
        assertThat(body.get("ownerId").asText()).isEqualTo(setup.ownerId().toString());
    }

    @Test
    void createWithStartReviewStartsCycle() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Review Product", 1);
        ResponseEntity<String> response = postCreate(setup, true);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = objectMapper.readTree(response.getBody());
        assertThat(body.get("status").asText()).isEqualTo("in_review");
        assertThat(body.get("cycle").get("status").asText()).isEqualTo("active");
        UUID materialId = UUID.fromString(body.get("id").asText());
        postApprove(materialId, setup.groupId(), setup.reviewer1Id());
    }

    @Test
    void groupTooSmallOnCreateRollsBack() throws Exception {
        var setup = fixtures.seedGroupTooSmallProduct();
        int before = fixtures.countMaterials();
        ResponseEntity<String> response = postCreate(setup, true);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        JsonNode error = objectMapper.readTree(response.getBody()).get("error");
        assertThat(error.get("code").asText()).isEqualTo("GROUP_TOO_SMALL");
        assertThat(fixtures.countMaterials()).isEqualTo(before);
    }

    @Test
    void rejectNonPdfUpload() {
        var setup = fixtures.seedSingleStepProduct("Pdf Product", 1);
        MultiValueMap<String, Object> form = createForm(setup, false);
        form.set("file", pdfResource(MaterialWriteFixtures.NOT_PDF_BYTES, "fake.pdf", "application/pdf"));
        ResponseEntity<String> response = postMultipart("/api/materials", setup.ownerId(), form);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void uploadV2OnDraftWithoutCycle() throws Exception {
        var setup = fixtures.seedSingleStepProduct("V2 Product", 1);
        UUID materialId = createMaterialId(setup, false);
        ResponseEntity<String> v2 = postVersion(materialId, setup.ownerId(), MaterialWriteFixtures.PDF_BYTES, "v2.pdf", null, false);
        assertThat(v2.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = objectMapper.readTree(v2.getBody());
        assertThat(body.get("currentVersionNumber").asInt()).isEqualTo(2);
        assertThat(body.get("status").asText()).isEqualTo("draft");
    }

    @Test
    void uploadV3DuringActiveReviewRestartsAtStepOne() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Restart Product", 1);
        UUID materialId = createMaterialId(setup, true);
        approveAllOnStepOne(materialId, setup);
        assertThat(fixtures.findApprovedVersionId(materialId)).isNotNull();

        postVersion(materialId, setup.ownerId(), MaterialWriteFixtures.PDF_BYTES, "v2.pdf", null, true);
        UUID materialIdFinal = materialId;
        assertThat(getDetail(materialIdFinal, setup.ownerId()).get("status").asText()).isEqualTo("in_review");

        ResponseEntity<String> v3 = postVersion(materialId, setup.ownerId(), MaterialWriteFixtures.PDF_BYTES, "v3.pdf", null, false);
        assertThat(v3.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode detail = objectMapper.readTree(v3.getBody());
        assertThat(detail.get("currentVersionNumber").asInt()).isEqualTo(3);
        assertThat(detail.get("cycle").get("currentPosition").asInt()).isEqualTo(1);
        assertThat(detail.get("status").asText()).isEqualTo("in_review");

        JsonNode versions = detail.get("versions");
        assertVersionStatus(versions, 1, "approved");
        assertVersionStatus(versions, 2, "draft");
        assertVersionStatus(versions, 3, "in_review");

        UUID approvedVersionId = fixtures.findApprovedVersionId(materialId);
        assertThat(versionIdForNumber(versions, 1)).isEqualTo(approvedVersionId);

        Integer restarted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM activity WHERE material_id = ? AND type = 'review_restarted'",
                Integer.class,
                materialId);
        assertThat(restarted).isEqualTo(1);
    }

    @Test
    void patchProductAllowedBeforeFirstCycle() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Patch Product", 1);
        UUID materialId = createMaterialId(setup, false);
        UUID otherProduct = fixtures.insertSecondProduct("Other Product");
        ResponseEntity<String> response = patch(materialId, setup.ownerId(), "{\"productId\": \"" + otherProduct + "\"}");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(response.getBody()).get("productId").asText())
                .isEqualTo(otherProduct.toString());
    }

    @Test
    void patchProductLockedAfterCycleIncludingAbandoned() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Lock Product", 1);
        UUID materialId = createMaterialId(setup, true);
        UUID otherProduct = fixtures.insertSecondProduct("Locked Other");
        ResponseEntity<String> blocked = patch(materialId, setup.ownerId(), "{\"productId\": \"" + otherProduct + "\"}");
        assertThat(blocked.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(objectMapper.readTree(blocked.getBody()).get("error").get("code").asText())
                .isEqualTo("PRODUCT_LOCKED");

        postVersion(materialId, setup.ownerId(), MaterialWriteFixtures.PDF_BYTES, "v2.pdf", null, false);
        ResponseEntity<String> stillBlocked =
                patch(materialId, setup.ownerId(), "{\"productId\": \"" + otherProduct + "\"}");
        assertThat(stillBlocked.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void ownerChangeWritesActivity() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Owner Product", 1);
        UUID materialId = createMaterialId(setup, false);
        UUID newOwner = fixtures.insertExtraUser("New Owner", "new-owner@test.local");
        patch(materialId, setup.ownerId(), "{\"ownerId\": \"" + newOwner + "\"}");
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM activity WHERE material_id = ? AND type = 'owner_changed'",
                Integer.class,
                materialId);
        assertThat(count).isEqualTo(1);
    }

    @Test
    void obsoleteAbandonsCycleAndBlocksMutations() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Obsolete Product", 1);
        UUID materialId = createMaterialId(setup, true);
        ResponseEntity<String> ob = postObsolete(materialId, setup.ownerId());
        assertThat(ob.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(ob.getBody()).get("status").asText()).isEqualTo("obsolete");

        Integer activeCycles = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_cycle WHERE material_id = ? AND status = 'active'",
                Integer.class,
                materialId);
        assertThat(activeCycles).isZero();

        assertThat(postObsolete(materialId, setup.ownerId()).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(postVersion(materialId, setup.ownerId(), MaterialWriteFixtures.PDF_BYTES, "x.pdf", null, false)
                        .getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(patch(materialId, setup.ownerId(), "{\"title\": \"Nope\"}").getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void parallelUploadsAssignDistinctVersionNumbers() throws Exception {
        var setup = fixtures.seedSingleStepProduct("Parallel Product", 1);
        UUID materialId = createMaterialId(setup, false);

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger created = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();

        Runnable upload = () -> {
            ready.countDown();
            try {
                go.await(10, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            ResponseEntity<String> response =
                    postVersion(materialId, setup.ownerId(), MaterialWriteFixtures.PDF_BYTES, "parallel.pdf", null, false);
            if (response.getStatusCode() == HttpStatus.CREATED) {
                created.incrementAndGet();
            } else {
                failed.incrementAndGet();
            }
        };

        Thread t1 = new Thread(upload);
        Thread t2 = new Thread(upload);
        t1.start();
        t2.start();
        assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
        go.countDown();
        t1.join(15_000);
        t2.join(15_000);

        assertThat(created.get()).isEqualTo(2);
        assertThat(fixtures.countMaterialVersions(materialId)).isEqualTo(3);
    }

    private UUID createMaterialId(MaterialWriteFixtures.ProductWorkflow setup, boolean startReview) throws Exception {
        ResponseEntity<String> response = postCreate(setup, startReview);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return UUID.fromString(objectMapper.readTree(response.getBody()).get("id").asText());
    }

    private ResponseEntity<String> postCreate(MaterialWriteFixtures.ProductWorkflow setup, boolean startReview) {
        return postMultipart("/api/materials", setup.ownerId(), createForm(setup, startReview));
    }

    private MultiValueMap<String, Object> createForm(MaterialWriteFixtures.ProductWorkflow setup, boolean startReview) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("title", "Test Material");
        form.add("productId", setup.productId().toString());
        form.add("channel", "web");
        form.add("audience", "consumer");
        form.add("intendedUse", "Demo use");
        form.add("file", pdfResource(MaterialWriteFixtures.PDF_BYTES, "v1.pdf", "application/pdf"));
        form.add("startReview", Boolean.toString(startReview));
        return form;
    }

    private ResponseEntity<String> postVersion(
            UUID materialId, UUID userId, byte[] bytes, String filename, String note, Boolean startReview) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", pdfResource(bytes, filename, "application/pdf"));
        if (note != null) {
            form.add("note", note);
        }
        if (startReview != null) {
            form.add("startReview", startReview.toString());
        }
        return postMultipart("/api/materials/" + materialId + "/versions", userId, form);
    }

    private ResponseEntity<String> patch(UUID materialId, UUID userId, String json) {
        HttpHeaders headers = authHeaders(userId);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/materials/" + materialId,
                HttpMethod.PATCH,
                new HttpEntity<>(json, headers),
                String.class);
    }

    private ResponseEntity<String> postObsolete(UUID materialId, UUID userId) {
        return restTemplate.exchange(
                "/api/materials/" + materialId + "/obsolete",
                HttpMethod.POST,
                new HttpEntity<>(authHeaders(userId)),
                String.class);
    }

    private ResponseEntity<String> postMultipart(String path, UUID userId, MultiValueMap<String, Object> form) {
        HttpHeaders headers = authHeaders(userId);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        return restTemplate.exchange(path, HttpMethod.POST, new HttpEntity<>(form, headers), String.class);
    }

    private void approveAllOnStepOne(UUID materialId, MaterialWriteFixtures.ProductWorkflow setup) {
        postApprove(materialId, setup.groupId(), setup.reviewer1Id());
        if (setup.reviewer2Id() != null) {
            postApprove(materialId, setup.groupId(), setup.reviewer2Id());
        }
    }

    private void postApprove(UUID materialId, UUID groupId, UUID userId) {
        HttpHeaders headers = authHeaders(userId);
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"groupId\": \"" + groupId + "\"}";
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/materials/" + materialId + "/approvals",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class);
        assertThat(response.getStatusCode())
                .withFailMessage(() -> "approve failed: " + response.getBody())
                .isEqualTo(HttpStatus.OK);
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

    private static ByteArrayResource pdfResource(byte[] bytes, String filename, String contentType) {
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    private HttpHeaders authHeaders(UUID userId) {
        String token = sessionTokenService.sign(userId, Instant.now().plus(1, ChronoUnit.HOURS));
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, sessionProperties.cookieName() + "=" + token);
        return headers;
    }

    private static void assertVersionStatus(JsonNode versions, int number, String expected) {
        for (JsonNode version : versions) {
            if (version.get("number").asInt() == number) {
                assertThat(version.get("versionStatus").asText()).isEqualTo(expected);
                return;
            }
        }
        throw new AssertionError("Version " + number + " not found");
    }

    private static UUID versionIdForNumber(JsonNode versions, int number) {
        for (JsonNode version : versions) {
            if (version.get("number").asInt() == number) {
                return UUID.fromString(version.get("id").asText());
            }
        }
        throw new AssertionError("Version " + number + " not found");
    }

    @TestConfiguration
    static class TestAuthConfig {

        @Bean
        @Primary
        CurrentUserLoader testMaterialWriteCurrentUserLoader(
                AppUserRepository users, MembershipRepository memberships) {
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
