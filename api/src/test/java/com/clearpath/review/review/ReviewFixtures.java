package com.clearpath.review.review;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class ReviewFixtures {

    public static final byte[] PDF_BYTES = "%PDF-1.4 test".getBytes();

    private final JdbcTemplate jdbcTemplate;

    public ReviewFixtures(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public DraftMaterial seedDraftTwoStepLegalQuorum() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        UUID ownerId = insertUser("Owner", "owner@review.test");
        UUID legal1 = insertUser("Legal One", "legal1@review.test");
        UUID legal2 = insertUser("Legal Two", "legal2@review.test");
        UUID compliance = insertUser("Compliance User", "compliance@review.test");

        UUID legalGroup = insertGroup("Legal");
        UUID complianceGroup = insertGroup("Compliance");
        insertMembership(legal1, legalGroup);
        insertMembership(legal2, legalGroup);
        insertMembership(compliance, complianceGroup);

        UUID productId = insertProduct("Quorum Product", 90);
        UUID step1 = insertWorkflowStep(productId, 1, "Legal review");
        insertStepRequirement(step1, legalGroup, 2);
        UUID step2 = insertWorkflowStep(productId, 2, "Compliance review");
        insertStepRequirement(step2, complianceGroup, 1);

        UUID materialId = insertMaterial("Quorum Material", productId, ownerId, now);
        UUID versionId = insertVersion(materialId, 1, ownerId, "v1.pdf", now);
        setCurrentVersion(materialId, versionId);

        return new DraftMaterial(
                materialId,
                versionId,
                productId,
                ownerId,
                legal1,
                legal2,
                compliance,
                legalGroup,
                complianceGroup,
                90);
    }

    public CreditCardScenario seedCreditCardParallelStep() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        UUID ownerId = insertUser("Card Owner", "card-owner@review.test");
        UUID legalUser = insertUser("Card Legal", "card-legal@review.test");
        UUID complianceUser = insertUser("Card Compliance", "card-compliance@review.test");
        UUID marketingUser = insertUser("Card Marketing", "card-marketing@review.test");

        UUID legalGroup = insertGroup("Legal");
        UUID complianceGroup = insertGroup("Compliance");
        UUID marketingGroup = insertGroup("Marketing");
        insertMembership(legalUser, legalGroup);
        insertMembership(complianceUser, complianceGroup);
        insertMembership(marketingUser, marketingGroup);

        UUID productId = insertProduct("Credit Card Product", 180);
        UUID step1 = insertWorkflowStep(productId, 1, "Legal & Compliance");
        insertStepRequirement(step1, legalGroup, 1);
        insertStepRequirement(step1, complianceGroup, 1);
        UUID step2 = insertWorkflowStep(productId, 2, "Marketing review");
        insertStepRequirement(step2, marketingGroup, 1);

        UUID materialId = insertMaterial("Card Banner", productId, ownerId, now);
        UUID versionId = insertVersion(materialId, 1, ownerId, "card.pdf", now);
        setCurrentVersion(materialId, versionId);

        return new CreditCardScenario(
                materialId, versionId, ownerId, legalGroup, complianceGroup, marketingGroup, legalUser, complianceUser, marketingUser, 180);
    }

    public DraftMaterial seedLegalQuorumWithParallelMarketing() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        UUID ownerId = insertUser("Extra Owner", "extra-owner@review.test");
        UUID legal1 = insertUser("Extra Legal One", "extra-legal1@review.test");
        UUID legal2 = insertUser("Extra Legal Two", "extra-legal2@review.test");
        UUID legal3 = insertUser("Extra Legal Three", "extra-legal3@review.test");
        UUID marketing = insertUser("Extra Marketing", "extra-marketing@review.test");
        UUID legalGroup = insertGroup("Legal");
        UUID marketingGroup = insertGroup("Marketing");
        insertMembership(legal1, legalGroup);
        insertMembership(legal2, legalGroup);
        insertMembership(legal3, legalGroup);
        insertMembership(marketing, marketingGroup);

        UUID productId = insertProduct("Extra Legal Product", 60);
        UUID step1 = insertWorkflowStep(productId, 1, "Legal and Marketing");
        insertStepRequirement(step1, legalGroup, 2);
        insertStepRequirement(step1, marketingGroup, 1);

        UUID materialId = insertMaterial("Extra Legal Material", productId, ownerId, now);
        UUID versionId = insertVersion(materialId, 1, ownerId, "extra.pdf", now);
        setCurrentVersion(materialId, versionId);

        return new DraftMaterial(
                materialId, versionId, productId, ownerId, legal1, legal2, legal3, legalGroup, marketingGroup, 60);
    }

    public DraftMaterial seedDualGroupReviewer() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        UUID ownerId = insertUser("Dual Owner", "dual-owner@review.test");
        UUID dual = insertUser("Dual Member", "dual@review.test");
        UUID legalGroup = insertGroup("Legal");
        UUID marketingGroup = insertGroup("Marketing");
        insertMembership(dual, legalGroup);
        insertMembership(dual, marketingGroup);

        UUID productId = insertProduct("Dual Group Product", 365);
        UUID step1 = insertWorkflowStep(productId, 1, "Parallel groups");
        insertStepRequirement(step1, legalGroup, 1);
        insertStepRequirement(step1, marketingGroup, 1);

        UUID materialId = insertMaterial("Dual Group Material", productId, ownerId, now);
        UUID versionId = insertVersion(materialId, 1, ownerId, "dual.pdf", now);
        setCurrentVersion(materialId, versionId);

        return new DraftMaterial(
                materialId, versionId, productId, ownerId, dual, dual, dual, legalGroup, marketingGroup, 365);
    }

    public DraftMaterial seedGroupTooSmallOnLaterStep() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        UUID ownerId = insertUser("Small Owner", "small-owner@review.test");
        UUID legal = insertUser("Solo Legal", "solo-legal@review.test");
        UUID legalGroup = insertGroup("Legal");
        UUID complianceGroup = insertGroup("Compliance");
        insertMembership(legal, legalGroup);

        UUID productId = insertProduct("Small Later Product", 30);
        UUID step1 = insertWorkflowStep(productId, 1, "Legal");
        insertStepRequirement(step1, legalGroup, 1);
        UUID step2 = insertWorkflowStep(productId, 2, "Compliance");
        insertStepRequirement(step2, complianceGroup, 1);

        UUID materialId = insertMaterial("Small Later Material", productId, ownerId, now);
        UUID versionId = insertVersion(materialId, 1, ownerId, "small.pdf", now);
        setCurrentVersion(materialId, versionId);

        return new DraftMaterial(
                materialId, versionId, productId, ownerId, legal, legal, legal, legalGroup, complianceGroup, 30);
    }

    public DraftMaterial seedObsoleteMaterial() {
        DraftMaterial draft = seedDraftTwoStepLegalQuorum();
        jdbcTemplate.update(
                "UPDATE material SET obsolete_at = now() WHERE id = ?", draft.materialId());
        return draft;
    }

    public void markObsolete(UUID materialId) {
        jdbcTemplate.update("UPDATE material SET obsolete_at = now() WHERE id = ?", materialId);
    }

    public int countNotifications(UUID userId, String kind) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM notification WHERE user_id = ? AND kind = ?",
                Integer.class,
                userId,
                kind);
        return count == null ? 0 : count;
    }

    public int countReviews(UUID cycleId, int position, UUID groupId, boolean counted) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM review
                WHERE cycle_id = ? AND position = ? AND group_id = ? AND counted = ?
                """,
                Integer.class,
                cycleId,
                position,
                groupId,
                counted);
        return count == null ? 0 : count;
    }

    public UUID findActiveCycleId(UUID materialId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM review_cycle WHERE material_id = ? AND status = 'active'",
                UUID.class,
                materialId);
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

    private UUID insertMaterial(String title, UUID productId, UUID ownerId, Instant updatedAt) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO material (id, product_id, owner_id, title, channel, audience, intended_use, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'web', 'consumer', 'Demo', ?, ?) RETURNING id
                """,
                UUID.class,
                UUID.randomUUID(),
                productId,
                ownerId,
                title,
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

    public record DraftMaterial(
            UUID materialId,
            UUID versionId,
            UUID productId,
            UUID ownerId,
            UUID reviewer1Id,
            UUID reviewer2Id,
            UUID reviewer3Id,
            UUID group1Id,
            UUID group2Id,
            int approvalLifetimeDays) {}

    public record CreditCardScenario(
            UUID materialId,
            UUID versionId,
            UUID ownerId,
            UUID legalGroupId,
            UUID complianceGroupId,
            UUID marketingGroupId,
            UUID legalUserId,
            UUID complianceUserId,
            UUID marketingUserId,
            int approvalLifetimeDays) {}
}
