package com.clearpath.review.web.tasks;

import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

public final class TaskFixtures {

    private final JdbcTemplate jdbc;

    public TaskFixtures(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insertUser(String name) {
        return jdbc.queryForObject(
                """
                INSERT INTO app_user (id, name, email, password_hash, created_at)
                VALUES (?, ?, ?, 'hash', now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                name,
                "user-" + UUID.randomUUID() + "@example.com");
    }

    public UUID insertGroup(String name) {
        return jdbc.queryForObject(
                "INSERT INTO user_group (id, name) VALUES (?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                name + "-" + UUID.randomUUID());
    }

    public void addMembership(UUID userId, UUID groupId) {
        jdbc.update("INSERT INTO membership (user_id, group_id) VALUES (?, ?)", userId, groupId);
    }

    public UUID insertProduct(String name) {
        return jdbc.queryForObject(
                "INSERT INTO product (id, name, approval_lifetime_days) VALUES (?, ?, 365) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                name);
    }

    public UUID insertFileBlob() {
        return jdbc.queryForObject(
                """
                INSERT INTO file_blob (id, content_type, bytes, size, sha256, created_at)
                VALUES (?, 'application/pdf', ?, 3, 'abc', now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                new byte[] {1, 2, 3});
    }

    public MaterialBundle insertMaterial(UUID ownerId, UUID productId, String title) {
        UUID materialId = jdbc.queryForObject(
                """
                INSERT INTO material (id, product_id, owner_id, title, channel, audience, intended_use, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'web', 'consumer', 'demo', now(), now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                productId,
                ownerId,
                title);
        UUID fileId = insertFileBlob();
        UUID versionId = jdbc.queryForObject(
                """
                INSERT INTO material_version (id, material_id, number, file_id, file_name, uploaded_by, uploaded_at)
                VALUES (?, ?, 1, ?, 'doc.pdf', ?, now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                fileId,
                ownerId);
        jdbc.update("UPDATE material SET current_version_id = ? WHERE id = ?", versionId, materialId);
        return new MaterialBundle(materialId, versionId);
    }

    public UUID insertActiveCycle(UUID materialId, UUID versionId, UUID startedBy, int currentPosition) {
        return jdbc.queryForObject(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position,
                    approval_lifetime_days, started_by, started_at)
                VALUES (?, ?, ?, 'active', ?, 365, ?, now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                versionId,
                currentPosition,
                startedBy);
    }

    public UUID insertAbandonedCycle(UUID materialId, UUID versionId, UUID startedBy) {
        return jdbc.queryForObject(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position,
                    approval_lifetime_days, started_by, started_at, ended_at)
                VALUES (?, ?, ?, 'abandoned', 1, 365, ?, now(), now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                versionId,
                startedBy);
    }

    public UUID insertCycleStep(UUID cycleId, int position, String name, Instant openedAt) {
        return jdbc.queryForObject(
                """
                INSERT INTO cycle_step (id, cycle_id, position, name, opened_at)
                VALUES (?, ?, ?, ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                cycleId,
                position,
                name,
                openedAt == null ? null : java.sql.Timestamp.from(openedAt));
    }

    public void insertCycleRequirement(UUID cycleStepId, UUID groupId, String groupName, int approvalsRequired) {
        jdbc.update(
                """
                INSERT INTO cycle_requirement (id, cycle_step_id, group_id, group_name, approvals_required)
                VALUES (?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                cycleStepId,
                groupId,
                groupName,
                approvalsRequired);
    }

    public void insertReview(
            UUID cycleId, int position, UUID groupId, UUID userId, boolean counted, Instant decidedAt) {
        jdbc.update(
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
                java.sql.Timestamp.from(decidedAt == null ? Instant.now() : decidedAt));
    }

    public void setMaterialApproved(UUID materialId, UUID versionId, Instant approvedUntil) {
        jdbc.update(
                """
                UPDATE material
                SET approved_version_id = ?, approved_at = now(), approved_until = ?
                WHERE id = ?
                """,
                versionId,
                java.sql.Timestamp.from(approvedUntil),
                materialId);
    }

    public void setMaterialObsolete(UUID materialId) {
        jdbc.update("UPDATE material SET obsolete_at = now() WHERE id = ?", materialId);
    }

    public void setVersionUploadedAt(UUID versionId, Instant uploadedAt) {
        jdbc.update(
                "UPDATE material_version SET uploaded_at = ? WHERE id = ?",
                java.sql.Timestamp.from(uploadedAt),
                versionId);
    }

    public void setStepOpenedAt(UUID cycleStepId, Instant openedAt) {
        jdbc.update(
                "UPDATE cycle_step SET opened_at = ? WHERE id = ?",
                java.sql.Timestamp.from(openedAt),
                cycleStepId);
    }

    public record MaterialBundle(UUID materialId, UUID versionId) {}
}
