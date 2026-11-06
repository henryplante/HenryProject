package com.clearpath.review.seed;

import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("seed")
public class SeedDataLoader {

    private static final Logger log = LoggerFactory.getLogger(SeedDataLoader.class);

    private final JdbcTemplate jdbc;
    private final DemoPdfGenerator pdfGenerator;
    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder(BCryptPasswordEncoder.BCryptVersion.$2A, 10);

    public SeedDataLoader(JdbcTemplate jdbc, DemoPdfGenerator pdfGenerator) {
        this.jdbc = jdbc;
        this.pdfGenerator = pdfGenerator;
    }

    public boolean isAlreadySeeded() {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM app_user WHERE email = ?", Integer.class, SeedConstants.MARKER_EMAIL);
        return count != null && count > 0;
    }

    @Transactional
    public void ensureSeeded() {
        if (isAlreadySeeded()) {
            log.info("Demo seed already present; skipping.");
            return;
        }
        loadAll();
    }

    @Transactional
    public void loadAll() {
        Instant now = Instant.now();
        String passwordHash = passwordEncoder.encode(SeedConstants.DEMO_PASSWORD);

        Map<String, UUID> groups = insertGroups();
        Map<String, UUID> users = insertUsers(passwordHash, now);
        insertMemberships(users, groups);

        Map<String, UUID> products = insertProducts();
        Map<String, UUID> steps = insertWorkflow(products, groups);

        SeedRefs refs = new SeedRefs(groups, users, products, steps, now);

        seedDraftMaterial(refs);
        seedApprovedMaterial(refs);
        seedExpiredLazyNotify(refs);
        seedExpiredNotified(refs);
        seedObsoleteMaterial(refs);
        seedExpiringSoonMaterial(refs);
        seedInReviewStep2(refs);
        seedOneShortOverdue(refs);
        seedWalkthroughMaterial(refs);
        seedCreditCardDualShort(refs);

        seedFavorites(refs);
        seedNotifications(refs);

        logSummary(users, groups);
    }

    private Map<String, UUID> insertGroups() {
        Map<String, UUID> ids = new LinkedHashMap<>();
        for (String name :
                List.of(SeedConstants.GROUP_MARKETING, SeedConstants.GROUP_LEGAL, SeedConstants.GROUP_COMPLIANCE)) {
            UUID id = UUID.randomUUID();
            jdbc.update("INSERT INTO user_group (id, name) VALUES (?, ?)", id, name);
            ids.put(name, id);
        }
        return ids;
    }

    private Map<String, UUID> insertUsers(String passwordHash, Instant now) {
        List<UserRow> rows = List.of(
                new UserRow("Maya Chen", "maya.chen"),
                new UserRow("James Rivera", "james.rivera"),
                new UserRow("Sofia Patel", "sofia.patel"),
                new UserRow("Alex Kim", "alex.kim"),
                new UserRow("Jordan Lee", "jordan.lee"),
                new UserRow("Morgan Taylor", "morgan.taylor"),
                new UserRow("Riley Davis", "riley.davis"),
                new UserRow("Casey Brooks", "casey.brooks"));
        Map<String, UUID> ids = new LinkedHashMap<>();
        for (UserRow row : rows) {
            UUID id = UUID.randomUUID();
            String email = row.localPart + SeedConstants.EMAIL_DOMAIN;
            jdbc.update(
                    "INSERT INTO app_user (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                    id,
                    row.name,
                    email,
                    passwordHash,
                    ts(now.minus(90, ChronoUnit.DAYS)));
            ids.put(row.localPart, id);
        }
        return ids;
    }

    private void insertMemberships(Map<String, UUID> users, Map<String, UUID> groups) {
        addMember(users, groups, "maya.chen", SeedConstants.GROUP_MARKETING);
        addMember(users, groups, "james.rivera", SeedConstants.GROUP_LEGAL);
        addMember(users, groups, "sofia.patel", SeedConstants.GROUP_LEGAL);
        addMember(users, groups, "alex.kim", SeedConstants.GROUP_COMPLIANCE);
        addMember(users, groups, "jordan.lee", SeedConstants.GROUP_COMPLIANCE);
        addMember(users, groups, "morgan.taylor", SeedConstants.GROUP_MARKETING);
        addMember(users, groups, "riley.davis", SeedConstants.GROUP_LEGAL);
        addMember(users, groups, "riley.davis", SeedConstants.GROUP_COMPLIANCE);
        addMember(users, groups, "casey.brooks", SeedConstants.GROUP_MARKETING);
    }

    private void addMember(Map<String, UUID> users, Map<String, UUID> groups, String userKey, String groupName) {
        jdbc.update(
                "INSERT INTO membership (user_id, group_id) VALUES (?, ?)",
                users.get(userKey),
                groups.get(groupName));
    }

    private Map<String, UUID> insertProducts() {
        Map<String, UUID> ids = new LinkedHashMap<>();
        insertProduct(ids, SeedConstants.PRODUCT_PERSONAL_LOANS, 365);
        insertProduct(ids, SeedConstants.PRODUCT_CREDIT_CARDS, 180);
        insertProduct(ids, SeedConstants.PRODUCT_MORTGAGE, 365);
        return ids;
    }

    private void insertProduct(Map<String, UUID> ids, String name, int lifetimeDays) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO product (id, name, approval_lifetime_days) VALUES (?, ?, ?)", id, name, lifetimeDays);
        ids.put(name, id);
    }

    private Map<String, UUID> insertWorkflow(Map<String, UUID> products, Map<String, UUID> groups) {
        Map<String, UUID> stepIds = new LinkedHashMap<>();
        UUID personal = products.get(SeedConstants.PRODUCT_PERSONAL_LOANS);
        stepIds.put("personal-1", workflowStep(personal, 1, "Legal review", groups.get(SeedConstants.GROUP_LEGAL), 2));
        stepIds.put("personal-2", workflowStep(personal, 2, "Compliance review", groups.get(SeedConstants.GROUP_COMPLIANCE), 1));

        UUID cards = products.get(SeedConstants.PRODUCT_CREDIT_CARDS);
        UUID cardsStep1 = workflowStep(cards, 1, "Legal & Compliance", null, 0);
        stepIds.put("cards-1", cardsStep1);
        req(cardsStep1, groups.get(SeedConstants.GROUP_LEGAL), 1);
        req(cardsStep1, groups.get(SeedConstants.GROUP_COMPLIANCE), 1);
        stepIds.put(
                "cards-2",
                workflowStep(cards, 2, "Marketing review", groups.get(SeedConstants.GROUP_MARKETING), 1));

        UUID mortgage = products.get(SeedConstants.PRODUCT_MORTGAGE);
        stepIds.put("mortgage-1", workflowStep(mortgage, 1, "Legal review", groups.get(SeedConstants.GROUP_LEGAL), 1));
        stepIds.put(
                "mortgage-2",
                workflowStep(mortgage, 2, "Compliance review", groups.get(SeedConstants.GROUP_COMPLIANCE), 2));
        return stepIds;
    }

    private UUID workflowStep(UUID productId, int position, String name, UUID singleGroup, int approvals) {
        UUID stepId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO workflow_step (id, product_id, position, name) VALUES (?, ?, ?, ?)",
                stepId,
                productId,
                position,
                name);
        if (singleGroup != null && approvals > 0) {
            req(stepId, singleGroup, approvals);
        }
        return stepId;
    }

    private void req(UUID stepId, UUID groupId, int approvalsRequired) {
        jdbc.update(
                "INSERT INTO step_requirement (id, step_id, group_id, approvals_required) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(),
                stepId,
                groupId,
                approvalsRequired);
    }

    private void seedDraftMaterial(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("casey.brooks");
        Instant created = r.now.minus(12, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_MORTGAGE),
                owner,
                "Mortgage prequal landing page draft",
                "web",
                "consumer",
                "Prequalification landing page",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "mortgage-draft-v1.pdf", "Initial draft", r.now.minus(11, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        activity(materialId, owner, "uploaded", r.now.minus(11, ChronoUnit.DAYS), detail("version", 1));
        activity(materialId, owner, "product_changed", created, detail("product", SeedConstants.PRODUCT_MORTGAGE));
    }

    private void seedApprovedMaterial(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("morgan.taylor");
        Instant created = r.now.minus(60, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_PERSONAL_LOANS),
                owner,
                "Fixed-rate personal loan email",
                "email",
                "consumer",
                "Consumer email campaign",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "personal-loan-approved.pdf", "Ready for send", r.now.minus(55, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant approvedAt = r.now.minus(50, ChronoUnit.DAYS);
        Instant approvedUntil = r.now.plus(200, ChronoUnit.DAYS);
        completedCycle(
                materialId,
                v1,
                owner,
                365,
                approvedAt,
                r.now.minus(58, ChronoUnit.DAYS),
                List.of(
                        stepDone(
                                1,
                                "Legal review",
                                r.now.minus(57, ChronoUnit.DAYS),
                                r.now.minus(56, ChronoUnit.DAYS),
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 2))),
                        stepDone(
                                2,
                                "Compliance review",
                                r.now.minus(56, ChronoUnit.DAYS),
                                r.now.minus(50, ChronoUnit.DAYS),
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 1)))),
                List.of(
                        review(r.user("james.rivera"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(56, ChronoUnit.DAYS)),
                        review(r.user("sofia.patel"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(56, ChronoUnit.DAYS)),
                        review(r.user("alex.kim"), 2, r.group(SeedConstants.GROUP_COMPLIANCE), true, r.now.minus(50, ChronoUnit.DAYS))),
                approvedAt,
                approvedUntil);
        activity(materialId, owner, "fully_approved", approvedAt, detail("version", 1));
        activity(
                materialId,
                r.user("maya.chen"),
                "owner_changed",
                r.now.minus(59, ChronoUnit.DAYS),
                detail("owner", "morgan.taylor"));
    }

    private void seedExpiredLazyNotify(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("casey.brooks");
        Instant created = r.now.minus(400, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_PERSONAL_LOANS),
                owner,
                "Holiday personal loan social post",
                "social",
                "consumer",
                "Seasonal social campaign",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "holiday-social.pdf", "Approved last year", r.now.minus(395, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant approvedAt = r.now.minus(380, ChronoUnit.DAYS);
        Instant approvedUntil = r.now.minus(15, ChronoUnit.DAYS);
        completedCycle(
                materialId,
                v1,
                owner,
                365,
                approvedAt,
                r.now.minus(390, ChronoUnit.DAYS),
                List.of(
                        stepDone(
                                1,
                                "Legal review",
                                r.now.minus(389, ChronoUnit.DAYS),
                                r.now.minus(385, ChronoUnit.DAYS),
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 2))),
                        stepDone(
                                2,
                                "Compliance review",
                                r.now.minus(385, ChronoUnit.DAYS),
                                approvedAt,
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 1)))),
                List.of(
                        review(r.user("james.rivera"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(386, ChronoUnit.DAYS)),
                        review(r.user("sofia.patel"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(385, ChronoUnit.DAYS)),
                        review(r.user("jordan.lee"), 2, r.group(SeedConstants.GROUP_COMPLIANCE), true, approvedAt)),
                approvedAt,
                approvedUntil);
        jdbc.update(
                "UPDATE material SET expiry_notified_at = NULL WHERE id = ?",
                materialId);
    }

    private void seedExpiredNotified(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("morgan.taylor");
        Instant created = r.now.minus(300, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_CREDIT_CARDS),
                owner,
                "Cash-back credit card web banner",
                "web",
                "consumer",
                "Homepage banner",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "cashback-banner.pdf", "Legacy banner", r.now.minus(295, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant approvedAt = r.now.minus(280, ChronoUnit.DAYS);
        Instant approvedUntil = r.now.minus(60, ChronoUnit.DAYS);
        completedCycle(
                materialId,
                v1,
                owner,
                180,
                approvedAt,
                r.now.minus(290, ChronoUnit.DAYS),
                cardSteps(r, approvedAt),
                cardReviews(r, approvedAt),
                approvedAt,
                approvedUntil);
        jdbc.update(
                "UPDATE material SET expiry_notified_at = ? WHERE id = ?",
                ts(r.now.minus(10, ChronoUnit.DAYS)),
                materialId);
        notification(
                owner,
                materialId,
                null,
                "material_expired",
                r.now.minus(10, ChronoUnit.DAYS),
                r.now.minus(9, ChronoUnit.DAYS),
                "{}");
    }

    private void seedObsoleteMaterial(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("james.rivera");
        Instant created = r.now.minus(120, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_MORTGAGE),
                owner,
                "Retired mortgage rate sheet",
                "email",
                "consumer",
                "Rate sheet email",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "rate-sheet-old.pdf", "Superseded", r.now.minus(115, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant approvedAt = r.now.minus(100, ChronoUnit.DAYS);
        Instant approvedUntil = r.now.plus(100, ChronoUnit.DAYS);
        completedCycle(
                materialId,
                v1,
                owner,
                365,
                approvedAt,
                r.now.minus(110, ChronoUnit.DAYS),
                List.of(
                        stepDone(
                                1,
                                "Legal review",
                                r.now.minus(109, ChronoUnit.DAYS),
                                r.now.minus(105, ChronoUnit.DAYS),
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 1))),
                        stepDone(
                                2,
                                "Compliance review",
                                r.now.minus(105, ChronoUnit.DAYS),
                                approvedAt,
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 2)))),
                List.of(
                        review(r.user("sofia.patel"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(105, ChronoUnit.DAYS)),
                        review(r.user("alex.kim"), 2, r.group(SeedConstants.GROUP_COMPLIANCE), true, approvedAt.minus(1, ChronoUnit.DAYS)),
                        review(r.user("jordan.lee"), 2, r.group(SeedConstants.GROUP_COMPLIANCE), true, approvedAt)),
                approvedAt,
                approvedUntil);
        Instant obsoleteAt = r.now.minus(5, ChronoUnit.DAYS);
        jdbc.update(
                "UPDATE material SET obsolete_at = ?, updated_at = ? WHERE id = ?",
                ts(obsoleteAt),
                ts(obsoleteAt),
                materialId);
        activity(materialId, owner, "obsolete", obsoleteAt, detail("reason", "product sunset"));
        notification(owner, materialId, owner, "obsolete", obsoleteAt, null, "{}");
    }

    private void seedExpiringSoonMaterial(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("alex.kim");
        Instant created = r.now.minus(340, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_PERSONAL_LOANS),
                owner,
                "Spring personal loan direct mail",
                "email",
                "consumer",
                "Direct mail piece",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "spring-mail.pdf", "Approved", r.now.minus(335, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant approvedAt = r.now.minus(330, ChronoUnit.DAYS);
        Instant approvedUntil = r.now.plus(20, ChronoUnit.DAYS);
        completedCycle(
                materialId,
                v1,
                owner,
                365,
                approvedAt,
                r.now.minus(334, ChronoUnit.DAYS),
                List.of(
                        stepDone(
                                1,
                                "Legal review",
                                r.now.minus(333, ChronoUnit.DAYS),
                                r.now.minus(332, ChronoUnit.DAYS),
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 2))),
                        stepDone(
                                2,
                                "Compliance review",
                                r.now.minus(332, ChronoUnit.DAYS),
                                approvedAt,
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 1)))),
                List.of(
                        review(r.user("james.rivera"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(332, ChronoUnit.DAYS)),
                        review(r.user("riley.davis"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(332, ChronoUnit.DAYS)),
                        review(r.user("jordan.lee"), 2, r.group(SeedConstants.GROUP_COMPLIANCE), true, approvedAt)),
                approvedAt,
                approvedUntil);
    }

    private void seedInReviewStep2(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("maya.chen");
        Instant created = r.now.minus(20, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_PERSONAL_LOANS),
                owner,
                "Rate sheet Q1 email",
                "email",
                "consumer",
                "Quarterly rate email",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "rate-q1.pdf", "Q1 update", r.now.minus(18, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant started = r.now.minus(17, ChronoUnit.DAYS);
        activeCycle(
                materialId,
                v1,
                owner,
                365,
                2,
                started,
                List.of(
                        stepOpen(
                                1,
                                "Legal review",
                                started,
                                r.now.minus(10, ChronoUnit.DAYS),
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 2))),
                        stepOpen(
                                2,
                                "Compliance review",
                                r.now.minus(10, ChronoUnit.DAYS),
                                null,
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 1)))),
                List.of(
                        review(r.user("james.rivera"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(16, ChronoUnit.DAYS)),
                        review(r.user("sofia.patel"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(15, ChronoUnit.DAYS))));
        activity(materialId, owner, "review_started", started, detail("version", 1));
        activity(materialId, r.user("james.rivera"), "approved", r.now.minus(16, ChronoUnit.DAYS), detail("step", 1));
        activity(materialId, owner, "step_completed", r.now.minus(10, ChronoUnit.DAYS), detail("step", 1));
        Instant step2Opened = r.now.minus(10, ChronoUnit.DAYS);
        UUID sofia = r.user("sofia.patel");
        notification(r.user("alex.kim"), materialId, sofia, "step_opened", step2Opened, r.now.minus(9, ChronoUnit.DAYS), detail("step", 2));
        notification(r.user("jordan.lee"), materialId, sofia, "step_opened", step2Opened, null, detail("step", 2));
        notification(r.user("riley.davis"), materialId, sofia, "step_opened", step2Opened, null, detail("step", 2));
        notification(owner, materialId, sofia, "step_completed", step2Opened, null, detail("step", 1));
    }

    private void seedOneShortOverdue(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("morgan.taylor");
        Instant created = r.now.minus(8, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_PERSONAL_LOANS),
                owner,
                "Promotional APR email",
                "email",
                "consumer",
                "Limited-time APR promo",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "promo-apr.pdf", "APR promo", r.now.minus(7, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant stepOpened = r.now.minus(4, ChronoUnit.DAYS);
        activeCycle(
                materialId,
                v1,
                owner,
                365,
                1,
                stepOpened.minus(1, ChronoUnit.DAYS),
                List.of(
                        stepOpen(
                                1,
                                "Legal review",
                                stepOpened,
                                null,
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 2))),
                        stepOpen(
                                2,
                                "Compliance review",
                                null,
                                null,
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 1)))),
                List.of(review(r.user("james.rivera"), 1, r.group(SeedConstants.GROUP_LEGAL), true, stepOpened)));
        activity(materialId, owner, "review_started", stepOpened.minus(1, ChronoUnit.DAYS), detail("version", 1));
        UUID james = r.user("james.rivera");
        notification(james, materialId, owner, "step_opened", stepOpened, r.now.minus(3, ChronoUnit.DAYS), detail("step", 1));
        notification(r.user("sofia.patel"), materialId, owner, "step_opened", stepOpened, r.now.minus(2, ChronoUnit.DAYS), detail("step", 1));
        notification(r.user("riley.davis"), materialId, owner, "step_opened", stepOpened, null, detail("step", 1));
        notification(owner, materialId, james, "approved", stepOpened, null, detail("step", 1, "groupName", "Legal"));
        Instant commentedAt = r.now.minus(4, ChronoUnit.DAYS).plus(2, ChronoUnit.HOURS);
        jdbc.update(
                "INSERT INTO comment (id, version_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(),
                v1,
                james,
                "Approved on my side. Second Legal approval still needed.",
                ts(commentedAt));
        activity(materialId, james, "comment_added", commentedAt, detail("version", 1));
        notification(owner, materialId, james, "comment_added", commentedAt, r.now.minus(3, ChronoUnit.DAYS), detail("version", 1));
    }

    private void seedWalkthroughMaterial(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("maya.chen");
        Instant created = r.now.minus(45, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_PERSONAL_LOANS),
                owner,
                SeedConstants.WALKTHROUGH_TITLE,
                "affiliate",
                "partner",
                "Affiliate partner email",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "affiliate-spring-v1.pdf", "Spring partner offer", r.now.minus(40, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);

        Instant v1ApprovedAt = r.now.minus(35, ChronoUnit.DAYS);
        Instant v1Until = r.now.plus(300, ChronoUnit.DAYS);
        completedCycle(
                materialId,
                v1,
                owner,
                365,
                v1ApprovedAt,
                r.now.minus(38, ChronoUnit.DAYS),
                List.of(
                        stepDone(
                                1,
                                "Legal review",
                                r.now.minus(37, ChronoUnit.DAYS),
                                r.now.minus(36, ChronoUnit.DAYS),
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 2))),
                        stepDone(
                                2,
                                "Compliance review",
                                r.now.minus(36, ChronoUnit.DAYS),
                                v1ApprovedAt,
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 1)))),
                List.of(
                        review(r.user("james.rivera"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(36, ChronoUnit.DAYS)),
                        review(r.user("sofia.patel"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(36, ChronoUnit.DAYS)),
                        review(r.user("alex.kim"), 2, r.group(SeedConstants.GROUP_COMPLIANCE), true, v1ApprovedAt)),
                v1ApprovedAt,
                v1Until);

        UUID v2 = insertVersion(materialId, 2, owner, "affiliate-spring-v2.pdf", "Revised offer copy", r.now.minus(6, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v2);

        Instant v2Started = r.now.minus(5, ChronoUnit.DAYS);
        Instant stepOpened = r.now.minus(5, ChronoUnit.DAYS);
        activeCycle(
                materialId,
                v2,
                owner,
                365,
                1,
                v2Started,
                List.of(
                        stepOpen(
                                1,
                                "Legal review",
                                stepOpened,
                                null,
                                List.of(req(r, SeedConstants.GROUP_LEGAL, 2))),
                        stepOpen(
                                2,
                                "Compliance review",
                                null,
                                null,
                                List.of(req(r, SeedConstants.GROUP_COMPLIANCE, 1)))),
                List.of());

        jdbc.update(
                """
                UPDATE material
                SET approved_version_id = ?, approved_at = ?, approved_until = ?, current_version_id = ?, updated_at = ?
                WHERE id = ?
                """,
                v1,
                ts(v1ApprovedAt),
                ts(v1Until),
                v2,
                ts(r.now.minus(5, ChronoUnit.DAYS)),
                materialId);

        UUID commentAuthor = r.user("james.rivera");
        jdbc.update(
                "INSERT INTO comment (id, version_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(),
                v2,
                commentAuthor,
                "Please clarify the APR footnote for affiliate partners.",
                ts(r.now.minus(4, ChronoUnit.DAYS)));

        activity(materialId, owner, "uploaded", r.now.minus(6, ChronoUnit.DAYS), detail("version", 2));
        activity(materialId, owner, "review_restarted", v2Started, detail("version", 2));
        notification(owner, materialId, commentAuthor, "comment_added", r.now.minus(4, ChronoUnit.DAYS), null, detail("version", 2));
        notification(r.user("james.rivera"), materialId, owner, "step_opened", stepOpened, null, detail("step", 1));
        notification(r.user("sofia.patel"), materialId, owner, "step_opened", stepOpened, r.now.minus(1, ChronoUnit.DAYS), detail("step", 1));
        notification(r.user("riley.davis"), materialId, owner, "step_opened", stepOpened, null, detail("step", 1));
    }

    private void seedCreditCardDualShort(SeedRefs r) {
        UUID materialId = UUID.randomUUID();
        UUID owner = r.user("casey.brooks");
        Instant created = r.now.minus(9, ChronoUnit.DAYS);
        insertMaterial(
                materialId,
                r.product(SeedConstants.PRODUCT_CREDIT_CARDS),
                owner,
                "Rewards signup web banner",
                "web",
                "consumer",
                "Rewards program signup",
                created,
                created);
        UUID v1 = insertVersion(materialId, 1, owner, "rewards-banner.pdf", "New creative", r.now.minus(8, ChronoUnit.DAYS));
        setCurrentVersion(materialId, v1);
        Instant started = r.now.minus(7, ChronoUnit.DAYS);
        Instant stepOpened = r.now.minus(3, ChronoUnit.DAYS);
        activeCycle(
                materialId,
                v1,
                owner,
                180,
                1,
                started,
                List.of(
                        stepOpen(
                                1,
                                "Legal & Compliance",
                                stepOpened,
                                null,
                                List.of(
                                        req(r, SeedConstants.GROUP_LEGAL, 1),
                                        req(r, SeedConstants.GROUP_COMPLIANCE, 1))),
                        stepOpen(
                                2,
                                "Marketing review",
                                null,
                                null,
                                List.of(req(r, SeedConstants.GROUP_MARKETING, 1)))),
                List.of());
        activity(materialId, owner, "review_started", started, detail("version", 1));
        notification(r.user("riley.davis"), materialId, owner, "step_opened", stepOpened, null, detail("step", 1));
        notification(r.user("james.rivera"), materialId, owner, "step_opened", stepOpened, r.now.minus(2, ChronoUnit.DAYS), detail("step", 1));
        notification(r.user("sofia.patel"), materialId, owner, "step_opened", stepOpened, null, detail("step", 1));
        notification(r.user("alex.kim"), materialId, owner, "step_opened", stepOpened, null, detail("step", 1));
        notification(r.user("jordan.lee"), materialId, owner, "step_opened", stepOpened, r.now.minus(1, ChronoUnit.DAYS), detail("step", 1));
    }

    private void seedFavorites(SeedRefs r) {
        favorite(r.user("maya.chen"), titleToMaterialId(r, SeedConstants.WALKTHROUGH_TITLE));
        favorite(r.user("james.rivera"), titleToMaterialId(r, SeedConstants.WALKTHROUGH_TITLE));
        favorite(r.user("morgan.taylor"), titleToMaterialId(r, "Promotional APR email"));
        favorite(r.user("casey.brooks"), titleToMaterialId(r, "Mortgage prequal landing page draft"));
        favorite(r.user("alex.kim"), titleToMaterialId(r, "Rate sheet Q1 email"));
    }

    private UUID titleToMaterialId(SeedRefs r, String title) {
        return jdbc.queryForObject("SELECT id FROM material WHERE title = ?", UUID.class, title);
    }

    private void favorite(UUID userId, UUID materialId) {
        jdbc.update("INSERT INTO favorite (user_id, material_id) VALUES (?, ?)", userId, materialId);
    }

    private void seedNotifications(SeedRefs r) {
        UUID approvedMat = titleToMaterialId(r, "Fixed-rate personal loan email");
        notification(
                r.user("morgan.taylor"),
                approvedMat,
                r.user("alex.kim"),
                "fully_approved",
                r.now.minus(50, ChronoUnit.DAYS),
                r.now.minus(49, ChronoUnit.DAYS),
                detail("version", 1));
        notification(
                r.user("morgan.taylor"),
                approvedMat,
                r.user("james.rivera"),
                "approved",
                r.now.minus(56, ChronoUnit.DAYS),
                null,
                detail("step", 1));
    }

    private void notification(
            UUID userId,
            UUID materialId,
            UUID actorId,
            String kind,
            Instant createdAt,
            Instant readAt,
            String detailJson) {
        jdbc.update(
                """
                INSERT INTO notification (id, user_id, material_id, actor_id, kind, detail, read_at, created_at)
                VALUES (?, ?, ?, ?, ?, jsonb_strip_nulls(
                    ?::jsonb || jsonb_build_object(
                        'actorName', (SELECT name FROM app_user WHERE id = ?),
                        'stepName', (
                            SELECT cs.name FROM cycle_step cs
                            JOIN review_cycle rc ON rc.id = cs.cycle_id
                            WHERE rc.material_id = ? AND cs.position = (?::jsonb ->> 'step')::int
                            ORDER BY rc.started_at DESC LIMIT 1))), ?, ?)
                """,
                UUID.randomUUID(),
                userId,
                materialId,
                actorId,
                kind,
                detailJson,
                actorId,
                materialId,
                detailJson,
                ts(readAt),
                ts(createdAt));
    }

    private void activity(UUID materialId, UUID actorId, String type, Instant at, String detailJson) {
        jdbc.update(
                "INSERT INTO activity (id, material_id, actor_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?::jsonb, ?)",
                UUID.randomUUID(),
                materialId,
                actorId,
                type,
                detailJson,
                ts(at));
    }

    private String detail(String key, Object value) {
        return "{\"" + key + "\": " + (value instanceof Number n ? n.toString() : "\"" + value + "\"") + "}";
    }

    private String detail(String key, Object value, String key2, Object value2) {
        return "{\"" + key + "\": " + jsonValue(value) + ", \"" + key2 + "\": " + jsonValue(value2) + "}";
    }

    private String jsonValue(Object value) {
        return value instanceof Number n ? n.toString() : "\"" + value + "\"";
    }

    private List<CycleStepSeed> cardSteps(SeedRefs r, Instant approvedAt) {
        return List.of(
                stepDone(
                        1,
                        "Legal & Compliance",
                        r.now.minus(289, ChronoUnit.DAYS),
                        r.now.minus(285, ChronoUnit.DAYS),
                        List.of(
                                req(r, SeedConstants.GROUP_LEGAL, 1),
                                req(r, SeedConstants.GROUP_COMPLIANCE, 1))),
                stepDone(
                        2,
                        "Marketing review",
                        r.now.minus(285, ChronoUnit.DAYS),
                        approvedAt,
                        List.of(req(r, SeedConstants.GROUP_MARKETING, 1))));
    }

    private List<ReviewRow> cardReviews(SeedRefs r, Instant approvedAt) {
        return List.of(
                review(r.user("riley.davis"), 1, r.group(SeedConstants.GROUP_LEGAL), true, r.now.minus(286, ChronoUnit.DAYS)),
                review(r.user("alex.kim"), 1, r.group(SeedConstants.GROUP_COMPLIANCE), true, r.now.minus(286, ChronoUnit.DAYS)),
                review(r.user("maya.chen"), 2, r.group(SeedConstants.GROUP_MARKETING), true, approvedAt));
    }

    private UUID activeCycle(
            UUID materialId,
            UUID versionId,
            UUID startedBy,
            int lifetimeDays,
            int currentPosition,
            Instant startedAt,
            List<CycleStepSeed> steps,
            List<ReviewRow> reviews) {
        UUID cycleId = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position, approval_lifetime_days, started_by, started_at, ended_at)
                VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL)
                """,
                cycleId,
                materialId,
                versionId,
                currentPosition,
                lifetimeDays,
                startedBy,
                ts(startedAt));
        insertCycleSteps(cycleId, steps);
        insertReviews(cycleId, reviews);
        return cycleId;
    }

    private void completedCycle(
            UUID materialId,
            UUID versionId,
            UUID startedBy,
            int lifetimeDays,
            Instant endedAt,
            Instant startedAt,
            List<CycleStepSeed> steps,
            List<ReviewRow> reviews,
            Instant approvedAt,
            Instant approvedUntil) {
        UUID cycleId = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO review_cycle (id, material_id, version_id, status, current_position, approval_lifetime_days, started_by, started_at, ended_at)
                VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?)
                """,
                cycleId,
                materialId,
                versionId,
                steps.size(),
                lifetimeDays,
                startedBy,
                ts(startedAt),
                ts(endedAt));
        insertCycleSteps(cycleId, steps);
        insertReviews(cycleId, reviews);
        jdbc.update(
                """
                UPDATE material
                SET current_version_id = ?, approved_version_id = ?, approved_at = ?, approved_until = ?, updated_at = ?
                WHERE id = ?
                """,
                versionId,
                versionId,
                ts(approvedAt),
                ts(approvedUntil),
                ts(endedAt),
                materialId);
    }

    private void insertCycleSteps(UUID cycleId, List<CycleStepSeed> steps) {
        for (CycleStepSeed step : steps) {
            UUID stepId = UUID.randomUUID();
            jdbc.update(
                    """
                    INSERT INTO cycle_step (id, cycle_id, position, name, opened_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    stepId,
                    cycleId,
                    step.position(),
                    step.name(),
                    ts(step.openedAt()),
                    ts(step.completedAt()));
            for (RequirementSeed requirement : step.requirements()) {
                jdbc.update(
                        """
                        INSERT INTO cycle_requirement (id, cycle_step_id, group_id, group_name, approvals_required)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        UUID.randomUUID(),
                        stepId,
                        requirement.groupId(),
                        requirement.groupName(),
                        requirement.approvalsRequired());
            }
        }
    }

    private void insertReviews(UUID cycleId, List<ReviewRow> reviews) {
        for (ReviewRow row : reviews) {
            jdbc.update(
                    """
                    INSERT INTO review (id, cycle_id, position, group_id, user_id, counted, decided_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    UUID.randomUUID(),
                    cycleId,
                    row.position,
                    row.groupId,
                    row.userId,
                    row.counted,
                    ts(row.decidedAt));
        }
    }

    private CycleStepSeed stepOpen(
            int position, String name, Instant openedAt, Instant completedAt, List<RequirementSeed> requirements) {
        return new CycleStepSeed(position, name, openedAt, completedAt, requirements);
    }

    private CycleStepSeed stepDone(
            int position, String name, Instant openedAt, Instant completedAt, List<RequirementSeed> requirements) {
        return new CycleStepSeed(position, name, openedAt, completedAt, requirements);
    }

    private RequirementSeed req(SeedRefs refs, String groupKey, int approvalsRequired) {
        return new RequirementSeed(refs.group(groupKey), groupKey, approvalsRequired);
    }

    private ReviewRow review(UUID userId, int position, UUID groupId, boolean counted, Instant decidedAt) {
        return new ReviewRow(userId, position, groupId, counted, decidedAt);
    }

    private void insertMaterial(
            UUID id,
            UUID productId,
            UUID ownerId,
            String title,
            String channel,
            String audience,
            String intendedUse,
            Instant createdAt,
            Instant updatedAt) {
        jdbc.update(
                """
                INSERT INTO material (id, product_id, owner_id, title, channel, audience, intended_use, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id,
                productId,
                ownerId,
                title,
                channel,
                audience,
                intendedUse,
                ts(createdAt),
                ts(updatedAt));
    }

    private UUID insertVersion(
            UUID materialId, int number, UUID uploadedBy, String fileName, String note, Instant uploadedAt) {
        String title = jdbc.queryForObject("SELECT title FROM material WHERE id = ?", String.class, materialId);
        byte[] pdf = pdfGenerator.generate(title, number);
        UUID fileId = insertFile(pdf, uploadedAt);
        UUID versionId = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO material_version (id, material_id, number, file_id, file_name, uploaded_by, uploaded_at, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                versionId,
                materialId,
                number,
                fileId,
                fileName,
                uploadedBy,
                ts(uploadedAt),
                note);
        return versionId;
    }

    private UUID insertFile(byte[] bytes, Instant createdAt) {
        UUID id = UUID.randomUUID();
        String sha256 = sha256(bytes);
        jdbc.update(
                "INSERT INTO file_blob (id, content_type, bytes, size, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                id,
                "application/pdf",
                bytes,
                (long) bytes.length,
                sha256,
                ts(createdAt));
        return id;
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private void setCurrentVersion(UUID materialId, UUID versionId) {
        jdbc.update("UPDATE material SET current_version_id = ?, updated_at = now() WHERE id = ?", versionId, materialId);
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void logSummary(Map<String, UUID> users, Map<String, UUID> groups) {
        log.info("");
        log.info("=== ClearPath demo seed ===");
        log.info("Password for all users: {}", SeedConstants.DEMO_PASSWORD);
        log.info("");
        log.info("| Name | Email | Groups |");
        log.info("| --- | --- | --- |");
        for (UserRow row :
                List.of(
                        new UserRow("Maya Chen", "maya.chen"),
                        new UserRow("James Rivera", "james.rivera"),
                        new UserRow("Sofia Patel", "sofia.patel"),
                        new UserRow("Alex Kim", "alex.kim"),
                        new UserRow("Jordan Lee", "jordan.lee"),
                        new UserRow("Morgan Taylor", "morgan.taylor"),
                        new UserRow("Riley Davis", "riley.davis"),
                        new UserRow("Casey Brooks", "casey.brooks"))) {
            String email = row.localPart + SeedConstants.EMAIL_DOMAIN;
            List<String> groupNames = jdbc.query(
                    """
                    SELECT g.name FROM membership m
                    JOIN user_group g ON g.id = m.group_id
                    JOIN app_user u ON u.id = m.user_id
                    WHERE u.email = ?
                    ORDER BY g.name
                    """,
                    (rs, i) -> rs.getString(1),
                    email);
            log.info("| {} | {} | {} |", row.name, email, String.join(", ", groupNames));
        }
        log.info("");
    }

    private record UserRow(String name, String localPart) {}

    private record CycleStepSeed(
            int position, String name, Instant openedAt, Instant completedAt, List<RequirementSeed> requirements) {}

    private record RequirementSeed(UUID groupId, String groupName, int approvalsRequired) {}

    private record ReviewRow(UUID userId, int position, UUID groupId, boolean counted, Instant decidedAt) {}

    private static final class SeedRefs {
        private final Map<String, UUID> groups;
        private final Map<String, UUID> users;
        private final Map<String, UUID> products;
        private final Instant now;

        SeedRefs(Map<String, UUID> groups, Map<String, UUID> users, Map<String, UUID> products, Map<String, UUID> steps, Instant now) {
            this.groups = groups;
            this.users = users;
            this.products = products;
            this.now = now;
        }

        UUID user(String key) {
            return users.get(key);
        }

        UUID product(String key) {
            return products.get(key);
        }

        UUID group(String key) {
            return groups.get(key);
        }
    }
}
