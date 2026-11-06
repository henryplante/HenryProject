package com.clearpath.review.web.materials;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class MaterialWriteFixtures {

    public static final byte[] PDF_BYTES = "%PDF-1.4 material-write".getBytes();
    public static final byte[] NOT_PDF_BYTES = "not a pdf".getBytes();

    private final JdbcTemplate jdbcTemplate;

    public MaterialWriteFixtures(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public ProductWorkflow seedSingleStepProduct(String productName, int approvalsRequired) {
        UUID ownerId = insertUser("Write Owner", "write-owner@test.local");
        UUID reviewer1 = insertUser("Reviewer One", "rev1@test.local");
        UUID reviewer2 = approvalsRequired > 1 ? insertUser("Reviewer Two", "rev2@test.local") : null;
        UUID groupId = insertGroup("Write Legal");
        insertMembership(reviewer1, groupId);
        if (reviewer2 != null) {
            insertMembership(reviewer2, groupId);
        }

        UUID productId = insertProduct(productName, 90);
        UUID stepId = insertWorkflowStep(productId, 1, "Legal");
        insertStepRequirement(stepId, groupId, approvalsRequired);

        return new ProductWorkflow(productId, ownerId, reviewer1, reviewer2, groupId, 90);
    }

    public ProductWorkflow seedGroupTooSmallProduct() {
        UUID ownerId = insertUser("Small Owner", "small-owner@test.local");
        UUID loneMember = insertUser("Lone Member", "lone@test.local");
        UUID groupId = insertGroup("Tiny Group");
        insertMembership(loneMember, groupId);

        UUID productId = insertProduct("Too Small Product", 60);
        UUID stepId = insertWorkflowStep(productId, 1, "Step 1");
        insertStepRequirement(stepId, groupId, 2);

        return new ProductWorkflow(productId, ownerId, loneMember, null, groupId, 60);
    }

    public UUID insertSecondProduct(String name) {
        return insertProduct(name, 120);
    }

    public UUID insertExtraUser(String name, String email) {
        return insertUser(name, email);
    }

    public int countMaterials() {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM material", Integer.class);
    }

    public int countMaterialVersions(UUID materialId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM material_version WHERE material_id = ?", Integer.class, materialId);
    }

    public UUID findApprovedVersionId(UUID materialId) {
        return jdbcTemplate.queryForObject(
                "SELECT approved_version_id FROM material WHERE id = ?", UUID.class, materialId);
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
        jdbcTemplate.update(
                "INSERT INTO membership (user_id, group_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
                userId,
                groupId);
    }

    private UUID insertProduct(String name, int lifetimeDays) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO product (id, name, approval_lifetime_days)
                VALUES (?, ?, ?) RETURNING id
                """,
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

    public record ProductWorkflow(
            UUID productId,
            UUID ownerId,
            UUID reviewer1Id,
            UUID reviewer2Id,
            UUID groupId,
            int approvalLifetimeDays) {}
}
