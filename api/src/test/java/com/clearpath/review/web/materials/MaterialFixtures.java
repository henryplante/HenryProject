package com.clearpath.review.web.materials;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class MaterialFixtures {

    public static final byte[] PDF_BYTES = "%PDF-1.4 test".getBytes();

    private final JdbcTemplate jdbcTemplate;

    public MaterialFixtures(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Scenario seedWalkthroughScenario() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);

        UUID ownerId = insertUser("Owner User", "owner@example.com");
        UUID dualReviewerId = insertUser("Dual Reviewer", "dual@example.com");
        UUID otherId = insertUser("Other User", "other@example.com");

        UUID legalId = insertGroup("Legal");
        UUID marketingId = insertGroup("Marketing");

        insertMembership(ownerId, legalId);
        insertMembership(dualReviewerId, legalId);
        insertMembership(dualReviewerId, marketingId);
        insertMembership(otherId, marketingId);

        UUID productId = insertProduct("Walkthrough Product", 365);
        UUID stepId = insertWorkflowStep(productId, 1, "Legal Review");
        insertStepRequirement(stepId, legalId, 2);
        insertStepRequirement(stepId, marketingId, 1);

        UUID ownedOtherMaterialId = insertMaterial(
                "Other Owned Email Piece", productId, otherId, "email", now.minus(2, ChronoUnit.DAYS));
        UUID ownedOtherVersionId = insertVersion(ownedOtherMaterialId, 1, ownerId, "other-v1.pdf", now.minus(2, ChronoUnit.DAYS));
        setCurrentVersion(ownedOtherMaterialId, ownedOtherVersionId);

        UUID materialId = insertMaterial(
                "Walkthrough Banner", productId, ownerId, "web", now.minus(1, ChronoUnit.DAYS));
        UUID v1Id = insertVersion(materialId, 1, ownerId, "banner-v1.pdf", now.minus(3, ChronoUnit.DAYS));
        UUID v2Id = insertVersion(materialId, 2, ownerId, "banner-v2.pdf", now.minus(2, ChronoUnit.DAYS));
        UUID v3Id = insertVersion(materialId, 3, ownerId, "banner-v3.pdf", now.minus(1, ChronoUnit.DAYS));
        jdbcTemplate.update(
                """
                UPDATE material
                SET current_version_id = ?, approved_version_id = ?, approved_at = ?, approved_until = ?
                WHERE id = ?
                """,
                v3Id,
                v1Id,
                Timestamp.from(now.minus(2, ChronoUnit.DAYS)),
                Timestamp.from(now.plus(30, ChronoUnit.DAYS)),
                materialId);

        UUID v1CycleId = insertCompletedCycle(materialId, v1Id, ownerId, now.minus(2, ChronoUnit.DAYS));
        insertCompletedCycleStep(v1CycleId, legalId, marketingId, now.minus(2, ChronoUnit.DAYS));

        UUID v3CycleId = insertActiveCycle(materialId, v3Id, ownerId, 1, now);
        UUID openStepId = insertCycleStep(v3CycleId, 1, "Legal Review", now, null);
        insertCycleRequirement(openStepId, legalId, "Legal", 2);
        insertCycleRequirement(openStepId, marketingId, "Marketing", 1);
        insertReview(v3CycleId, 1, legalId, ownerId, true, now);

        jdbcTemplate.update(
                "INSERT INTO favorite (user_id, material_id) VALUES (?, ?)", dualReviewerId, materialId);

        jdbcTemplate.update(
                """
                INSERT INTO comment (id, version_id, author_id, body, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                v3Id,
                dualReviewerId,
                "Please check headline",
                Timestamp.from(now));

        jdbcTemplate.update(
                """
                INSERT INTO activity (id, material_id, actor_id, type, detail, created_at)
                VALUES (?, ?, ?, 'review_started', '{"versionNumber": 3}'::jsonb, ?)
                """,
                UUID.randomUUID(),
                materialId,
                ownerId,
                Timestamp.from(now));

        return new Scenario(
                ownerId,
                dualReviewerId,
                otherId,
                legalId,
                marketingId,
                productId,
                materialId,
                v1Id,
                v2Id,
                v3Id,
                v3CycleId,
                ownedOtherMaterialId);
    }

    private UUID insertUser(String name, String email) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO app_user (id, name, email, password_hash, created_at)
                VALUES (?, ?, ?, 'hash', now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                name,
                email);
    }

    private UUID insertGroup(String name) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO user_group (id, name) VALUES (?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                name);
    }

    private void insertMembership(UUID userId, UUID groupId) {
        jdbcTemplate.update("INSERT INTO membership (user_id, group_id) VALUES (?, ?)", userId, groupId);
    }

    private UUID insertProduct(String name, int lifetimeDays) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO product (id, name, approval_lifetime_days) VALUES (?, ?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                name,
                lifetimeDays);
    }

    private UUID insertWorkflowStep(UUID productId, int position, String name) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO workflow_step (id, product_id, position, name)
                VALUES (?, ?, ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                productId,
                position,
                name);
    }

    private void insertStepRequirement(UUID stepId, UUID groupId, int required) {
        jdbcTemplate.update(
                """
                INSERT INTO step_requirement (id, step_id, group_id, approvals_required)
                VALUES (?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                stepId,
                groupId,
                required);
    }

    private UUID insertMaterial(String title, UUID productId, UUID ownerId, String channel, Instant updatedAt) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO material (id, product_id, owner_id, title, channel, audience, intended_use, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'consumer', 'Demo', ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                productId,
                ownerId,
                title,
                channel,
                Timestamp.from(updatedAt),
                Timestamp.from(updatedAt));
    }

    private UUID insertFileBlob(Instant createdAt) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO file_blob (id, content_type, bytes, size, sha256, created_at)
                VALUES (?, 'application/pdf', ?, ?, 'test-sha', ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                PDF_BYTES,
                PDF_BYTES.length,
                Timestamp.from(createdAt));
    }

    private UUID insertVersion(UUID materialId, int number, UUID uploaderId, String fileName, Instant uploadedAt) {
        UUID fileId = insertFileBlob(uploadedAt);
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO material_version (id, material_id, number, file_id, file_name, uploaded_by, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                number,
                fileId,
                fileName,
                uploaderId,
                Timestamp.from(uploadedAt));
    }

    private void setCurrentVersion(UUID materialId, UUID versionId) {
        jdbcTemplate.update("UPDATE material SET current_version_id = ? WHERE id = ?", versionId, materialId);
    }

    private UUID insertCompletedCycle(UUID materialId, UUID versionId, UUID starterId, Instant ended) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position, approval_lifetime_days,
                                          started_by, started_at, ended_at)
                VALUES (?, ?, ?, 'completed', 1, 365, ?, ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                versionId,
                starterId,
                Timestamp.from(ended.minus(1, ChronoUnit.DAYS)),
                Timestamp.from(ended));
    }

    private UUID insertActiveCycle(
            UUID materialId, UUID versionId, UUID starterId, int position, Instant started) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position, approval_lifetime_days,
                                          started_by, started_at)
                VALUES (?, ?, ?, 'active', ?, 365, ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                versionId,
                position,
                starterId,
                Timestamp.from(started));
    }

    private UUID insertCycleStep(UUID cycleId, int position, String name, Instant opened, Instant completed) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO cycle_step (id, cycle_id, position, name, opened_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                cycleId,
                position,
                name,
                opened == null ? null : Timestamp.from(opened),
                completed == null ? null : Timestamp.from(completed));
    }

    private void insertCompletedCycleStep(UUID cycleId, UUID legalId, UUID marketingId, Instant when) {
        UUID stepId = insertCycleStep(cycleId, 1, "Legal Review", when, when);
        insertCycleRequirement(stepId, legalId, "Legal", 2);
        insertCycleRequirement(stepId, marketingId, "Marketing", 1);
    }

    private void insertCycleRequirement(UUID cycleStepId, UUID groupId, String groupName, int need) {
        jdbcTemplate.update(
                """
                INSERT INTO cycle_requirement (id, cycle_step_id, group_id, group_name, approvals_required)
                VALUES (?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                cycleStepId,
                groupId,
                groupName,
                need);
    }

    private void insertReview(
            UUID cycleId, int position, UUID groupId, UUID userId, boolean counted, Instant decidedAt) {
        jdbcTemplate.update(
                """
                INSERT INTO review (id, cycle_id, position, group_id, user_id, counted, decided_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                cycleId,
                position,
                groupId,
                userId,
                counted,
                Timestamp.from(decidedAt));
    }

    public record Scenario(
            UUID ownerId,
            UUID dualReviewerId,
            UUID otherId,
            UUID legalId,
            UUID marketingId,
            UUID productId,
            UUID materialId,
            UUID v1Id,
            UUID v2Id,
            UUID v3Id,
            UUID v3CycleId,
            UUID ownedOtherMaterialId) {}
}
