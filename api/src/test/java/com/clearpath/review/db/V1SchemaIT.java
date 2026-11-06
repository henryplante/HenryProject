package com.clearpath.review.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.clearpath.review.support.AbstractPostgresIT;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

class V1SchemaIT extends AbstractPostgresIT {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void flywayMigrationCreatesCoreObjects() {
        assertThat(jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material'",
                        Integer.class))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'material_status_v'",
                        Integer.class))
                .isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'version_status_v'",
                        Integer.class))
                .isEqualTo(1);
    }

    @Test
    void rejectsSecondActiveCycleForSameMaterial() {
        FixtureIds ids = insertMinimalMaterialWithVersion();
        insertActiveCycle(ids.materialId(), ids.versionId(), ids.userId());
        assertThatThrownBy(() -> insertActiveCycle(ids.materialId(), ids.versionId(), ids.userId()))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(ex -> assertThat(rootCause(ex)).isInstanceOf(SQLException.class));
    }

    @Test
    void stepRequirementMustRequireAtLeastOneApproval() {
        UUID stepId = insertWorkflowTemplate();
        UUID groupId = jdbcTemplate.queryForObject(
                "INSERT INTO user_group (id, name) VALUES (?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                "g-" + UUID.randomUUID());
        assertThatThrownBy(() -> jdbcTemplate.update(
                        "INSERT INTO step_requirement (id, step_id, group_id, approvals_required) VALUES (?, ?, ?, ?)",
                        UUID.randomUUID(),
                        stepId,
                        groupId,
                        0))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void productApprovalLifetimeMustBePositive() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                        "INSERT INTO product (id, name, approval_lifetime_days) VALUES (?, ?, ?)",
                        UUID.randomUUID(),
                        "p-" + UUID.randomUUID(),
                        0))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void reviewIsUniquePerUserGroupAndPosition() {
        FixtureIds ids = insertMinimalMaterialWithVersion();
        UUID cycleId = insertActiveCycle(ids.materialId(), ids.versionId(), ids.userId());
        UUID groupId = jdbcTemplate.queryForObject(
                "INSERT INTO user_group (id, name) VALUES (?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                "reviewers-" + UUID.randomUUID());
        jdbcTemplate.update(
                "INSERT INTO review (id, cycle_id, position, group_id, user_id, counted) VALUES (?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(),
                cycleId,
                1,
                groupId,
                ids.userId(),
                true);
        assertThatThrownBy(() -> jdbcTemplate.update(
                        "INSERT INTO review (id, cycle_id, position, group_id, user_id, counted) VALUES (?, ?, ?, ?, ?, ?)",
                        UUID.randomUUID(),
                        cycleId,
                        1,
                        groupId,
                        ids.userId(),
                        false))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void materialStatusViewCoversAllBranches() {
        FixtureIds draftOnly = insertMinimalMaterialWithVersion();
        assertMaterialStatus(draftOnly.materialId(), "draft");

        FixtureIds obsolete = insertMinimalMaterialWithVersion();
        jdbcTemplate.update(
                "UPDATE material SET obsolete_at = now() WHERE id = ?", obsolete.materialId());
        assertMaterialStatus(obsolete.materialId(), "obsolete");

        FixtureIds inReview = insertMinimalMaterialWithVersion();
        insertActiveCycle(inReview.materialId(), inReview.versionId(), inReview.userId());
        assertMaterialStatus(inReview.materialId(), "in_review");

        FixtureIds approved = insertApprovedMaterial(Instant.now().plus(30, ChronoUnit.DAYS));
        assertMaterialStatus(approved.materialId(), "approved");

        FixtureIds expired = insertApprovedMaterial(Instant.now().minus(1, ChronoUnit.DAYS));
        assertMaterialStatus(expired.materialId(), "expired");

        FixtureIds newerDraft = insertApprovedWithNewerDraftVersion();
        assertMaterialStatus(newerDraft.materialId(), "draft");
    }

    @Test
    void versionStatusViewCoversAllBranches() {
        FixtureIds ids = insertMinimalMaterialWithVersion();
        assertVersionStatus(ids.versionId(), "draft");

        UUID inReviewCycle = insertActiveCycle(ids.materialId(), ids.versionId(), ids.userId());
        assertVersionStatus(ids.versionId(), "in_review");
        jdbcTemplate.update(
                "UPDATE review_cycle SET status = 'abandoned', ended_at = now() WHERE id = ?", inReviewCycle);

        UUID completedCycle = insertCompletedCycle(ids.materialId(), ids.versionId(), ids.userId());
        assertVersionStatus(ids.versionId(), "approved");
        jdbcTemplate.update("UPDATE review_cycle SET status = 'abandoned' WHERE id = ?", completedCycle);

        insertActiveCycle(ids.materialId(), ids.versionId(), ids.userId());
        assertVersionStatus(ids.versionId(), "in_review");
    }

    private void assertMaterialStatus(UUID materialId, String expected) {
        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM material_status_v WHERE material_id = ?", String.class, materialId);
        assertThat(status).isEqualTo(expected);
    }

    private void assertVersionStatus(UUID versionId, String expected) {
        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM version_status_v WHERE version_id = ?", String.class, versionId);
        assertThat(status).isEqualTo(expected);
    }

    private FixtureIds insertMinimalMaterialWithVersion() {
        UUID userId = insertUser();
        UUID productId = jdbcTemplate.queryForObject(
                "INSERT INTO product (id, name, approval_lifetime_days) VALUES (?, ?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                "product-" + UUID.randomUUID(),
                365);
        UUID materialId = jdbcTemplate.queryForObject(
                """
                INSERT INTO material (id, product_id, owner_id, title, channel, audience, intended_use, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'web', 'consumer', 'demo', now(), now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                productId,
                userId,
                "Material " + UUID.randomUUID());
        UUID fileId = insertFileBlob();
        UUID versionId = jdbcTemplate.queryForObject(
                """
                INSERT INTO material_version (id, material_id, number, file_id, file_name, uploaded_by, uploaded_at)
                VALUES (?, ?, 1, ?, 'doc.pdf', ?, now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                fileId,
                userId);
        jdbcTemplate.update("UPDATE material SET current_version_id = ? WHERE id = ?", versionId, materialId);
        return new FixtureIds(userId, materialId, versionId);
    }

    private FixtureIds insertApprovedMaterial(Instant approvedUntil) {
        FixtureIds ids = insertMinimalMaterialWithVersion();
        insertCompletedCycle(ids.materialId(), ids.versionId(), ids.userId());
        jdbcTemplate.update(
                """
                UPDATE material
                SET approved_version_id = ?, approved_at = now(), approved_until = ?
                WHERE id = ?
                """,
                ids.versionId(),
                java.sql.Timestamp.from(approvedUntil),
                ids.materialId());
        return ids;
    }

    private FixtureIds insertApprovedWithNewerDraftVersion() {
        FixtureIds approved = insertApprovedMaterial(Instant.now().plus(30, ChronoUnit.DAYS));
        UUID fileId = insertFileBlob();
        UUID v2Id = jdbcTemplate.queryForObject(
                """
                INSERT INTO material_version (id, material_id, number, file_id, file_name, uploaded_by, uploaded_at)
                VALUES (?, ?, 2, ?, 'v2.pdf', ?, now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                approved.materialId(),
                fileId,
                approved.userId());
        jdbcTemplate.update(
                "UPDATE material SET current_version_id = ?, updated_at = now() WHERE id = ?",
                v2Id,
                approved.materialId());
        return new FixtureIds(approved.userId(), approved.materialId(), v2Id);
    }

    private UUID insertUser() {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO app_user (id, name, email, password_hash, created_at)
                VALUES (?, ?, ?, 'hash', now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                "User",
                "user-" + UUID.randomUUID() + "@example.com");
    }

    private UUID insertFileBlob() {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO file_blob (id, content_type, bytes, size, sha256, created_at)
                VALUES (?, 'application/pdf', ?, 3, 'abc', now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                new byte[] {1, 2, 3});
    }

    private UUID insertWorkflowTemplate() {
        UUID productId = jdbcTemplate.queryForObject(
                "INSERT INTO product (id, name, approval_lifetime_days) VALUES (?, ?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                "wf-" + UUID.randomUUID(),
                30);
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO workflow_step (id, product_id, position, name)
                VALUES (?, ?, 1, 'Legal') RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                productId);
    }

    private UUID insertActiveCycle(UUID materialId, UUID versionId, UUID userId) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position,
                    approval_lifetime_days, started_by, started_at)
                VALUES (?, ?, ?, 'active', 1, 365, ?, now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                versionId,
                userId);
    }

    private UUID insertCompletedCycle(UUID materialId, UUID versionId, UUID userId) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position,
                    approval_lifetime_days, started_by, started_at, ended_at)
                VALUES (?, ?, ?, 'completed', 1, 365, ?, now(), now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                versionId,
                userId);
    }

    private static Throwable rootCause(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current;
    }

    private record FixtureIds(UUID userId, UUID materialId, UUID versionId) {}
}
