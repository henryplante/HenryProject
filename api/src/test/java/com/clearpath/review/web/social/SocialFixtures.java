package com.clearpath.review.web.social;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

public final class SocialFixtures {

    public static final byte[] PDF_BYTES = "%PDF-social".getBytes();

    private final JdbcTemplate jdbc;

    public SocialFixtures(JdbcTemplate jdbc) {
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
                "social-" + UUID.randomUUID() + "@example.com");
    }

    public UUID insertProduct() {
        return jdbc.queryForObject(
                "INSERT INTO product (id, name, approval_lifetime_days) VALUES (?, ?, 365) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                "Social Product");
    }

    public UUID insertFileBlob() {
        return jdbc.queryForObject(
                """
                INSERT INTO file_blob (id, content_type, bytes, size, sha256, created_at)
                VALUES (?, 'application/pdf', ?, ?, 'sha', now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                PDF_BYTES,
                PDF_BYTES.length);
    }

    public MaterialBundle insertMaterial(UUID ownerId, UUID productId, String title) {
        return insertMaterial(ownerId, productId, title, null, null, null);
    }

    public MaterialBundle insertExpiredMaterial(UUID ownerId, UUID productId, String title, Instant approvedUntil) {
        Instant approvedAt = approvedUntil.minus(30, ChronoUnit.DAYS);
        MaterialBundle bundle = insertMaterial(ownerId, productId, title, approvedAt, approvedUntil, null);
        jdbc.update(
                """
                UPDATE material
                SET approved_version_id = ?, approved_at = ?, approved_until = ?, expiry_notified_at = NULL
                WHERE id = ?
                """,
                bundle.versionId(),
                Timestamp.from(approvedAt),
                Timestamp.from(approvedUntil),
                bundle.materialId());
        return bundle;
    }

    public MaterialBundle insertFutureApprovedMaterial(UUID ownerId, UUID productId, String title) {
        Instant now = Instant.now();
        Instant until = now.plus(30, ChronoUnit.DAYS);
        MaterialBundle bundle = insertMaterial(ownerId, productId, title, now.minus(1, ChronoUnit.DAYS), until, null);
        jdbc.update(
                """
                UPDATE material
                SET approved_version_id = ?, approved_at = ?, approved_until = ?, expiry_notified_at = NULL
                WHERE id = ?
                """,
                bundle.versionId(),
                Timestamp.from(now.minus(1, ChronoUnit.DAYS)),
                Timestamp.from(until),
                bundle.materialId());
        return bundle;
    }

    public void markObsolete(UUID materialId) {
        jdbc.update("UPDATE material SET obsolete_at = now() WHERE id = ?", materialId);
    }

    public MaterialBundle insertMaterial(
            UUID ownerId,
            UUID productId,
            String title,
            Instant approvedAt,
            Instant approvedUntil,
            Instant updatedAt) {
        Instant created = Instant.now().minus(2, ChronoUnit.DAYS);
        Instant updated = updatedAt != null ? updatedAt : created;
        UUID materialId = jdbc.queryForObject(
                """
                INSERT INTO material (id, product_id, owner_id, title, channel, audience, intended_use, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'web', 'consumer', 'demo', ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                productId,
                ownerId,
                title,
                Timestamp.from(created),
                Timestamp.from(updated));
        UUID fileId = insertFileBlob();
        UUID versionId = jdbc.queryForObject(
                """
                INSERT INTO material_version (id, material_id, number, file_id, file_name, uploaded_by, uploaded_at)
                VALUES (?, ?, 1, ?, 'doc.pdf', ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                fileId,
                ownerId,
                Timestamp.from(created));
        jdbc.update("UPDATE material SET current_version_id = ? WHERE id = ?", versionId, materialId);
        if (approvedAt != null && approvedUntil != null) {
            jdbc.update(
                    """
                    UPDATE material
                    SET approved_version_id = ?, approved_at = ?, approved_until = ?
                    WHERE id = ?
                    """,
                    versionId,
                    Timestamp.from(approvedAt),
                    Timestamp.from(approvedUntil),
                    materialId);
        }
        return new MaterialBundle(materialId, versionId);
    }

    public UUID insertNotification(
            UUID userId, UUID materialId, UUID actorId, String kind, Instant createdAt, Instant readAt) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO notification (id, user_id, material_id, actor_id, kind, detail, read_at, created_at)
                VALUES (?, ?, ?, ?, ?, '{}'::jsonb, ?, ?)
                """,
                id,
                userId,
                materialId,
                actorId,
                kind,
                readAt != null ? Timestamp.from(readAt) : null,
                Timestamp.from(createdAt));
        return id;
    }

    public UUID insertGroup(String name) {
        return jdbc.queryForObject(
                "INSERT INTO user_group (id, name) VALUES (?, ?) RETURNING id",
                UUID.class,
                UUID.randomUUID(),
                name);
    }

    public void addMembership(UUID userId, UUID groupId) {
        jdbc.update("INSERT INTO membership (user_id, group_id) VALUES (?, ?)", userId, groupId);
    }

    public UUID insertActiveCycle(UUID materialId, UUID versionId, UUID startedBy) {
        return jdbc.queryForObject(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position,
                    approval_lifetime_days, started_by, started_at)
                VALUES (?, ?, ?, 'active', 1, 365, ?, now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                materialId,
                versionId,
                startedBy);
    }

    public UUID insertCycleStep(UUID cycleId, int position, String name) {
        return jdbc.queryForObject(
                """
                INSERT INTO cycle_step (id, cycle_id, position, name, opened_at)
                VALUES (?, ?, ?, ?, now()) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                cycleId,
                position,
                name);
    }

    public void insertCycleRequirement(UUID stepId, UUID groupId, String groupName, int need) {
        jdbc.update(
                """
                INSERT INTO cycle_requirement (id, cycle_step_id, group_id, group_name, approvals_required)
                VALUES (?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                stepId,
                groupId,
                groupName,
                need);
    }

    public Instant materialUpdatedAt(UUID materialId) {
        return jdbc.queryForObject(
                "SELECT updated_at FROM material WHERE id = ?", Instant.class, materialId);
    }

    public long countNotifications(UUID userId, String kind) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM notification WHERE user_id = ? AND kind = ?",
                Long.class,
                userId,
                kind);
    }

    public record MaterialBundle(UUID materialId, UUID versionId) {}
}
