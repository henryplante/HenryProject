package com.clearpath.review.walkthrough;

import static org.assertj.core.api.Assertions.assertThat;

import com.clearpath.review.seed.SeedConstants;
import com.clearpath.review.seed.SeedDataLoader;
import com.clearpath.review.support.AbstractPostgresIT;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

@ActiveProfiles({"test", "seed"})
class WalkthroughIT extends AbstractPostgresIT {

    private static final byte[] UPLOAD_PDF = "%PDF-1.4 walkthrough-upload".getBytes(StandardCharsets.US_ASCII);

    private static final String EMAIL_JAMES = "james.rivera" + SeedConstants.EMAIL_DOMAIN;
    private static final String EMAIL_SOFIA = "sofia.patel" + SeedConstants.EMAIL_DOMAIN;
    private static final String EMAIL_MAYA = "maya.chen" + SeedConstants.EMAIL_DOMAIN;
    private static final String EMAIL_ALEX = "alex.kim" + SeedConstants.EMAIL_DOMAIN;
    private static final String EMAIL_RILEY = "riley.davis" + SeedConstants.EMAIL_DOMAIN;
    private static final String EMAIL_CASEY = "casey.brooks" + SeedConstants.EMAIL_DOMAIN;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SeedDataLoader seedDataLoader;

    @BeforeAll
    void loadSeed() {
        seedDataLoader.ensureSeeded();
    }

    @Test
    void automatesDemoWalkthroughChecklistAndIntegrationExtras() throws Exception {
        SessionHttpClient session = new SessionHttpClient(restTemplate, objectMapper, "clearpath_session");

        assertUnauthorizedEnvelope();

        session.login(EMAIL_JAMES, SeedConstants.DEMO_PASSWORD);
        JsonNode users = parse(session.get("/api/users"));
        JsonNode groups = parse(session.get("/api/groups"));
        JsonNode products = parse(session.get("/api/products"));

        UUID legalGroupId = groupId(groups, SeedConstants.GROUP_LEGAL);
        UUID complianceGroupId = groupId(groups, SeedConstants.GROUP_COMPLIANCE);
        UUID personalLoansProductId = productId(products, SeedConstants.PRODUCT_PERSONAL_LOANS);
        UUID creditCardsProductId = productId(products, SeedConstants.PRODUCT_CREDIT_CARDS);
        UUID mortgageProductId = productId(products, SeedConstants.PRODUCT_MORTGAGE);

        UUID jamesId = userId(users, EMAIL_JAMES);
        UUID sofiaId = userId(users, EMAIL_SOFIA);
        UUID mayaId = userId(users, EMAIL_MAYA);
        UUID alexId = userId(users, EMAIL_ALEX);
        UUID rileyId = userId(users, EMAIL_RILEY);
        UUID caseyId = userId(users, EMAIL_CASEY);

        JsonNode mineTasks = parse(session.get("/api/tasks?tab=mine"));
        JsonNode walkthroughTask = findTaskByTitle(mineTasks, SeedConstants.WALKTHROUGH_TITLE);
        assertThat(walkthroughTask.get("overdue").asBoolean()).isTrue();
        assertThat(walkthroughTask.get("versionNumber").asInt()).isEqualTo(2);
        UUID walkthroughMaterialId = UUID.fromString(walkthroughTask.get("materialId").asText());

        JsonNode initialDetail = parse(session.get("/api/materials/" + walkthroughMaterialId));
        assertThat(initialDetail.get("status").asText()).isEqualTo("in_review");
        assertThat(initialDetail.get("currentVersionNumber").asInt()).isEqualTo(2);
        JsonNode versionsInitial = initialDetail.get("versions");
        UUID v1Id = versionId(versionsInitial, 1);
        UUID v2Id = versionId(versionsInitial, 2);
        assertVersionStatus(versionsInitial, 1, "approved");
        assertVersionStatus(versionsInitial, 2, "in_review");
        assertThat(versionField(versionsInitial, 1, "approvedUntil")).isNotNull();
        assertLegalStepper(initialDetail, 0, 2);

        ResponseEntity<byte[]> pdf = restTemplate.exchange(
                "/api/versions/" + v2Id + "/file",
                HttpMethod.GET,
                new HttpEntity<>(session.headers()),
                byte[].class);
        assertThat(pdf.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pdf.getHeaders().getContentType().toString()).contains("pdf");
        assertThat(new String(pdf.getBody(), 0, 4, StandardCharsets.US_ASCII)).isEqualTo("%PDF");

        JsonNode v2Comments = parse(session.get("/api/versions/" + v2Id + "/comments"));
        assertThat(v2Comments).isNotEmpty();
        assertThat(v2Comments.get(0).get("body").asText()).contains("APR footnote");

        assertLibraryFilters(
                session,
                personalLoansProductId,
                creditCardsProductId,
                mayaId,
                jamesId,
                walkthroughMaterialId);

        ResponseEntity<String> approveLegal = postJson(
                session,
                "/api/materials/" + walkthroughMaterialId + "/approvals",
                "{\"groupId\":\"" + legalGroupId + "\"}");
        assertThat(approveLegal.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode afterLegalApprove = objectMapper.readTree(approveLegal.getBody());
        assertLegalStepper(afterLegalApprove, 1, 2);

        JsonNode jamesMineAfter = parse(session.get("/api/tasks?tab=mine"));
        assertThat(findTaskByTitleOrNull(jamesMineAfter, SeedConstants.WALKTHROUGH_TITLE)).isNull();

        session.switchUser(mayaId.toString());
        JsonNode ownerComments = parse(session.get("/api/versions/" + v2Id + "/comments"));
        assertThat(ownerComments).isNotEmpty();

        ResponseEntity<String> v3Upload = postMultipart(
                session,
                "/api/materials/" + walkthroughMaterialId + "/versions",
                uploadForm("affiliate-spring-v3.pdf", null));
        assertThat(v3Upload.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode afterUpload = objectMapper.readTree(v3Upload.getBody());
        assertThat(afterUpload.get("status").asText()).isEqualTo("in_review");
        assertThat(afterUpload.get("currentVersionNumber").asInt()).isEqualTo(3);
        assertLegalStepper(afterUpload, 0, 2);

        JsonNode versionsAfterUpload = afterUpload.get("versions");
        assertVersionStatus(versionsAfterUpload, 1, "approved");
        assertVersionStatus(versionsAfterUpload, 2, "draft");
        assertVersionStatus(versionsAfterUpload, 3, "in_review");
        assertThat(versionId(versionsAfterUpload, 1)).isEqualTo(v1Id);
        assertThat(versionField(versionsAfterUpload, 1, "approvedUntil")).isNotNull();
        assertThat(afterUpload.get("status").asText()).isEqualTo("in_review");

        UUID v3Id = versionId(versionsAfterUpload, 3);

        session.switchUser(jamesId.toString());
        assertThat(postJson(
                        session,
                        "/api/materials/" + walkthroughMaterialId + "/approvals",
                        "{\"groupId\":\"" + legalGroupId + "\"}")
                .getStatusCode())
                .isEqualTo(HttpStatus.OK);

        session.switchUser(sofiaId.toString());
        JsonNode afterSofia = objectMapper.readTree(postJson(
                        session,
                        "/api/materials/" + walkthroughMaterialId + "/approvals",
                        "{\"groupId\":\"" + legalGroupId + "\"}")
                .getBody());
        assertThat(afterSofia.get("cycle").get("currentPosition").asInt()).isEqualTo(2);

        session.switchUser(alexId.toString());
        JsonNode fullyApproved = objectMapper.readTree(postJson(
                        session,
                        "/api/materials/" + walkthroughMaterialId + "/approvals",
                        "{\"groupId\":\"" + complianceGroupId + "\"}")
                .getBody());
        assertThat(fullyApproved.get("status").asText()).isEqualTo("approved");
        assertThat(fullyApproved.get("currentVersionNumber").asInt()).isEqualTo(3);
        assertVersionStatus(fullyApproved.get("versions"), 3, "approved");
        assertThat(versionField(fullyApproved.get("versions"), 3, "approvedUntil")).isNotNull();

        session.switchUser(mayaId.toString());
        JsonNode ownerNotifications = parse(session.get("/api/notifications"));
        assertThat(hasNotificationKind(ownerNotifications, "fully_approved", walkthroughMaterialId)).isTrue();

        JsonNode ownerWorkflows = parse(session.get("/api/tasks?tab=workflows"));
        assertThat(findTaskByTitleOrNull(ownerWorkflows, SeedConstants.WALKTHROUGH_TITLE)).isNull();

        session.switchUser(jamesId.toString());
        JsonNode jamesMineFinal = parse(session.get("/api/tasks?tab=mine"));
        assertThat(findTaskByTitleOrNull(jamesMineFinal, SeedConstants.WALKTHROUGH_TITLE)).isNull();

        session.switchUser(rileyId.toString());
        UUID creditCardMaterialId = findMaterialIdByTitle(session, "Rewards signup web banner");
        JsonNode creditDetail = parse(session.get("/api/materials/" + creditCardMaterialId));
        assertThat(creditDetail.get("capabilities").get("approvableGroups")).hasSize(2);

        JsonNode rileyMineBefore = parse(session.get("/api/tasks?tab=mine"));
        assertThat(findTaskByTitleOrNull(rileyMineBefore, "Rewards signup web banner")).isNotNull();

        assertThat(restTemplate
                        .exchange(
                                "/api/notifications/read-all",
                                HttpMethod.POST,
                                new HttpEntity<>(session.headers()),
                                String.class)
                        .getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        JsonNode rileyMineAfterRead = parse(session.get("/api/tasks?tab=mine"));
        assertThat(rileyMineAfterRead).isEqualTo(rileyMineBefore);

        UUID rileyLegalGroup = legalGroupId;
        assertThat(postJson(
                        session,
                        "/api/materials/" + creditCardMaterialId + "/approvals",
                        "{\"groupId\":\"" + rileyLegalGroup + "\"}")
                .getStatusCode())
                .isEqualTo(HttpStatus.OK);

        session.switchUser(caseyId.toString());
        UUID holidayExpiredMaterialId = findMaterialIdByTitle(session, "Holiday personal loan social post");
        JsonNode caseyFeedBefore = parse(session.get("/api/notifications"));
        int holidayExpiredBefore =
                countNotificationKindForMaterial(caseyFeedBefore, "material_expired", holidayExpiredMaterialId);
        assertThat(session.get("/api/materials").getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(session.get("/api/materials").getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode caseyFeedAfter = parse(session.get("/api/notifications"));
        int holidayExpiredAfter =
                countNotificationKindForMaterial(caseyFeedAfter, "material_expired", holidayExpiredMaterialId);
        assertThat(holidayExpiredAfter).isEqualTo(1);
        if (holidayExpiredBefore == 0) {
            assertThat(holidayExpiredAfter).isEqualTo(holidayExpiredBefore + 1);
        } else {
            assertThat(holidayExpiredBefore).isEqualTo(1);
        }
        assertThat(session.get("/api/materials").getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode caseyFeedThird = parse(session.get("/api/notifications"));
        assertThat(countNotificationKindForMaterial(caseyFeedThird, "material_expired", holidayExpiredMaterialId))
                .isEqualTo(1);

        session.switchUser(mayaId.toString());
        UUID draftMaterialId = findMaterialIdByTitle(session, "Mortgage prequal landing page draft");
        JsonNode draftDetail = parse(session.get("/api/materials/" + draftMaterialId));
        UUID draftVersionId = UUID.fromString(draftDetail.get("selectedVersionId").asText());
        ResponseEntity<String> lockConflict = patchJson(
                session,
                "/api/materials/" + walkthroughMaterialId,
                "{\"productId\":\"" + mortgageProductId + "\"}");
        assertError(lockConflict, HttpStatus.CONFLICT, "PRODUCT_LOCKED");

        ResponseEntity<String> draftPatchOk = patchJson(
                session,
                "/api/materials/" + draftMaterialId,
                "{\"productId\":\"" + personalLoansProductId + "\"}");
        assertThat(draftPatchOk.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<UUID> legalMembersOriginal = legalMemberIds(users, groups);
        List<UUID> shrunk = List.of(jamesId);
        assertThat(putJson(
                        session,
                        "/api/groups/" + legalGroupId + "/members",
                        memberIdsBody(shrunk))
                .getStatusCode())
                .isEqualTo(HttpStatus.OK);

        MultiValueMap<String, Object> tooSmallCreate = new LinkedMultiValueMap<>();
        tooSmallCreate.add("title", "Too small quorum test");
        tooSmallCreate.add("productId", personalLoansProductId.toString());
        tooSmallCreate.add("channel", "email");
        tooSmallCreate.add("audience", "consumer");
        tooSmallCreate.add("intendedUse", "Test");
        tooSmallCreate.add("file", pdfResource("too-small.pdf"));
        tooSmallCreate.add("startReview", "true");
        ResponseEntity<String> groupTooSmall = postMultipart(session, "/api/materials", tooSmallCreate);
        assertError(groupTooSmall, HttpStatus.CONFLICT, "GROUP_TOO_SMALL");

        assertThat(putJson(
                        session,
                        "/api/groups/" + legalGroupId + "/members",
                        memberIdsBody(legalMembersOriginal))
                .getStatusCode())
                .isEqualTo(HttpStatus.OK);

        ResponseEntity<String> obsoleteOk = restTemplate.exchange(
                "/api/materials/" + draftMaterialId + "/obsolete",
                HttpMethod.POST,
                new HttpEntity<>(session.headers()),
                String.class);
        assertThat(obsoleteOk.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(obsoleteOk.getBody()).get("status").asText()).isEqualTo("obsolete");

        ResponseEntity<String> obsoleteAgain = restTemplate.exchange(
                "/api/materials/" + draftMaterialId + "/obsolete",
                HttpMethod.POST,
                new HttpEntity<>(session.headers()),
                String.class);
        assertError(obsoleteAgain, HttpStatus.CONFLICT, "MATERIAL_OBSOLETE");

        ResponseEntity<String> obsoleteComment = postJson(
                session,
                "/api/versions/" + draftVersionId + "/comments",
                "{\"body\":\"Should fail\"}");
        assertError(obsoleteComment, HttpStatus.CONFLICT, "MATERIAL_OBSOLETE");

        assertThat(v3Id).isNotNull();
    }

    private void assertLibraryFilters(
            SessionHttpClient session,
            UUID personalLoansProductId,
            UUID creditCardsProductId,
            UUID mayaId,
            UUID restoreUserId,
            UUID walkthroughMaterialId)
            throws Exception {
        JsonNode bySearch = parse(session.get("/api/materials?q=Affiliate"));
        assertThat(findSummaryById(bySearch, walkthroughMaterialId)).isNotNull();

        JsonNode inReview = parse(session.get("/api/materials?status=in_review"));
        assertThat(inReview.isArray()).isTrue();
        assertThat(inReview).anyMatch(node -> walkthroughMaterialId.toString().equals(node.get("id").asText()));

        JsonNode byProduct = parse(session.get("/api/materials?productId=" + personalLoansProductId));
        assertThat(byProduct).anyMatch(node -> walkthroughMaterialId.toString().equals(node.get("id").asText()));

        JsonNode byChannel = parse(session.get("/api/materials?channel=affiliate"));
        assertThat(byChannel).anyMatch(node -> walkthroughMaterialId.toString().equals(node.get("id").asText()));

        JsonNode favorites = parse(session.get("/api/materials?favorites=true"));
        assertThat(favorites).anyMatch(node -> walkthroughMaterialId.toString().equals(node.get("id").asText()));

        session.switchUser(mayaId.toString());
        JsonNode owned = parse(session.get("/api/materials?owned=true"));
        assertThat(owned).anyMatch(node -> walkthroughMaterialId.toString().equals(node.get("id").asText()));
        session.switchUser(restoreUserId.toString());

        JsonNode creditOnly = parse(session.get("/api/materials?productId=" + creditCardsProductId));
        assertThat(creditOnly).noneMatch(node -> walkthroughMaterialId.toString().equals(node.get("id").asText()));
    }

    private void assertUnauthorizedEnvelope() throws Exception {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/materials", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        JsonNode error = objectMapper.readTree(response.getBody()).get("error");
        assertThat(error.get("code").asText()).isEqualTo("UNAUTHORIZED");
        assertThat(error.get("message").asText()).isNotBlank();
    }

    private void assertError(ResponseEntity<String> response, HttpStatus status, String code) throws Exception {
        assertThat(response.getStatusCode()).isEqualTo(status);
        JsonNode error = objectMapper.readTree(response.getBody()).get("error");
        assertThat(error.get("code").asText()).isEqualTo(code);
        assertThat(error.get("message").asText()).isNotBlank();
    }

    private JsonNode parse(ResponseEntity<String> response) throws Exception {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(response.getBody());
    }

    private ResponseEntity<String> postJson(SessionHttpClient session, String path, String json) {
        HttpHeaders headers = session.headers();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(path, HttpMethod.POST, new HttpEntity<>(json, headers), String.class);
    }

    private ResponseEntity<String> patchJson(SessionHttpClient session, String path, String json) {
        HttpHeaders headers = session.headers();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(path, HttpMethod.PATCH, new HttpEntity<>(json, headers), String.class);
    }

    private ResponseEntity<String> putJson(SessionHttpClient session, String path, String json) {
        HttpHeaders headers = session.headers();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(path, HttpMethod.PUT, new HttpEntity<>(json, headers), String.class);
    }

    private ResponseEntity<String> postMultipart(SessionHttpClient session, String path, MultiValueMap<String, Object> form) {
        return restTemplate.exchange(path, HttpMethod.POST, new HttpEntity<>(form, session.headers()), String.class);
    }

    private MultiValueMap<String, Object> uploadForm(String filename, Boolean startReview) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", pdfResource(filename));
        if (startReview != null) {
            form.add("startReview", startReview.toString());
        }
        return form;
    }

    private static ByteArrayResource pdfResource(String filename) {
        return new ByteArrayResource(UPLOAD_PDF) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    private static String memberIdsBody(List<UUID> userIds) {
        StringBuilder sb = new StringBuilder("{\"userIds\":[");
        for (int i = 0; i < userIds.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('"').append(userIds.get(i)).append('"');
        }
        sb.append("]}");
        return sb.toString();
    }

    private static UUID userId(JsonNode users, String email) {
        for (JsonNode user : users) {
            if (email.equals(user.get("email").asText())) {
                return UUID.fromString(user.get("id").asText());
            }
        }
        throw new AssertionError("Missing user " + email);
    }

    private static UUID groupId(JsonNode groups, String name) {
        for (JsonNode group : groups) {
            if (name.equals(group.get("name").asText())) {
                return UUID.fromString(group.get("id").asText());
            }
        }
        throw new AssertionError("Missing group " + name);
    }

    private static UUID productId(JsonNode products, String name) {
        for (JsonNode product : products) {
            if (name.equals(product.get("name").asText())) {
                return UUID.fromString(product.get("id").asText());
            }
        }
        throw new AssertionError("Missing product " + name);
    }

    private static List<UUID> legalMemberIds(JsonNode users, JsonNode groups) {
        UUID legalId = groupId(groups, SeedConstants.GROUP_LEGAL);
        List<UUID> ids = new ArrayList<>();
        for (JsonNode user : users) {
            for (JsonNode gid : user.get("groupIds")) {
                if (legalId.toString().equals(gid.asText())) {
                    ids.add(UUID.fromString(user.get("id").asText()));
                }
            }
        }
        return ids;
    }

    private static JsonNode findTaskByTitle(JsonNode tasks, String title) {
        JsonNode task = findTaskByTitleOrNull(tasks, title);
        assertThat(task).isNotNull();
        return task;
    }

    private static JsonNode findTaskByTitleOrNull(JsonNode tasks, String title) {
        for (JsonNode task : tasks) {
            if (title.equals(task.get("title").asText())) {
                return task;
            }
        }
        return null;
    }

    private UUID findMaterialIdByTitle(SessionHttpClient session, String title) throws Exception {
        JsonNode materials = parse(session.get("/api/materials?q=" + title.replace(' ', '+')));
        for (JsonNode material : materials) {
            if (title.equals(material.get("title").asText())) {
                return UUID.fromString(material.get("id").asText());
            }
        }
        throw new AssertionError("Missing material " + title);
    }

    private static JsonNode findSummaryById(JsonNode summaries, UUID id) {
        for (JsonNode summary : summaries) {
            if (id.toString().equals(summary.get("id").asText())) {
                return summary;
            }
        }
        return null;
    }

    private static UUID versionId(JsonNode versions, int number) {
        for (JsonNode version : versions) {
            if (version.get("number").asInt() == number) {
                return UUID.fromString(version.get("id").asText());
            }
        }
        throw new AssertionError("Missing version " + number);
    }

    private static void assertVersionStatus(JsonNode versions, int number, String status) {
        for (JsonNode version : versions) {
            if (version.get("number").asInt() == number) {
                assertThat(version.get("versionStatus").asText()).isEqualTo(status);
                return;
            }
        }
        throw new AssertionError("Missing version " + number);
    }

    private static JsonNode versionField(JsonNode versions, int number, String field) {
        for (JsonNode version : versions) {
            if (version.get("number").asInt() == number) {
                return version.get(field);
            }
        }
        throw new AssertionError("Missing version " + number);
    }

    private static void assertLegalStepper(JsonNode detail, int have, int need) {
        JsonNode steps = detail.get("cycle").get("steps");
        for (JsonNode step : steps) {
            if (!"active".equals(step.get("state").asText())) {
                continue;
            }
            for (JsonNode requirement : step.get("requirements")) {
                if (SeedConstants.GROUP_LEGAL.equals(requirement.get("groupName").asText())) {
                    assertThat(requirement.get("have").asInt()).isEqualTo(have);
                    assertThat(requirement.get("need").asInt()).isEqualTo(need);
                    return;
                }
            }
        }
        throw new AssertionError("No active Legal requirement");
    }

    private static boolean hasNotificationKind(JsonNode feed, String kind, UUID materialId) {
        for (JsonNode item : feed.get("items")) {
            if (kind.equals(item.get("kind").asText())
                    && materialId.toString().equals(item.get("materialId").asText())) {
                return true;
            }
        }
        return false;
    }

    private static int countNotificationKindForMaterial(JsonNode feed, String kind, UUID materialId) {
        int count = 0;
        for (JsonNode item : feed.get("items")) {
            if (kind.equals(item.get("kind").asText())
                    && materialId.toString().equals(item.get("materialId").asText())) {
                count++;
            }
        }
        return count;
    }
}
