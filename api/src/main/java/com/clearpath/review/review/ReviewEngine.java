package com.clearpath.review.review;

import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.CycleRequirement;
import com.clearpath.review.domain.CycleStep;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialVersion;
import com.clearpath.review.domain.Membership;
import com.clearpath.review.domain.MembershipRepository;
import com.clearpath.review.domain.Review;
import com.clearpath.review.domain.ReviewCycle;
import com.clearpath.review.domain.ReviewCycleRepository;
import com.clearpath.review.domain.ReviewCycleStatus;
import com.clearpath.review.domain.ReviewRepository;
import com.clearpath.review.domain.StepRequirement;
import com.clearpath.review.domain.StepRequirementRepository;
import com.clearpath.review.domain.UserGroup;
import com.clearpath.review.domain.WorkflowStep;
import com.clearpath.review.domain.WorkflowStepRepository;
import com.clearpath.review.domain.CycleRequirementRepository;
import com.clearpath.review.domain.CycleStepRepository;
import com.clearpath.review.domain.MaterialRepository;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.UserGroupRepository;
import com.clearpath.review.review.events.ReviewEventWriter;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewEngine {

    private final MaterialRepository materialRepository;
    private final ReviewCycleRepository reviewCycleRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final StepRequirementRepository stepRequirementRepository;
    private final CycleStepRepository cycleStepRepository;
    private final CycleRequirementRepository cycleRequirementRepository;
    private final ReviewRepository reviewRepository;
    private final MembershipRepository membershipRepository;
    private final UserGroupRepository userGroupRepository;
    private final AppUserRepository appUserRepository;
    private final ReviewEventWriter reviewEventWriter;

    public ReviewEngine(
            MaterialRepository materialRepository,
            ReviewCycleRepository reviewCycleRepository,
            WorkflowStepRepository workflowStepRepository,
            StepRequirementRepository stepRequirementRepository,
            CycleStepRepository cycleStepRepository,
            CycleRequirementRepository cycleRequirementRepository,
            ReviewRepository reviewRepository,
            MembershipRepository membershipRepository,
            UserGroupRepository userGroupRepository,
            AppUserRepository appUserRepository,
            ReviewEventWriter reviewEventWriter) {
        this.materialRepository = materialRepository;
        this.reviewCycleRepository = reviewCycleRepository;
        this.workflowStepRepository = workflowStepRepository;
        this.stepRequirementRepository = stepRequirementRepository;
        this.cycleStepRepository = cycleStepRepository;
        this.cycleRequirementRepository = cycleRequirementRepository;
        this.reviewRepository = reviewRepository;
        this.membershipRepository = membershipRepository;
        this.userGroupRepository = userGroupRepository;
        this.appUserRepository = appUserRepository;
        this.reviewEventWriter = reviewEventWriter;
    }

    @Transactional
    public ReviewCycle startCycle(Material material, MaterialVersion version, AppUser startedBy) {
        ensureNotObsolete(material);
        if (material.getCurrentVersion() == null) {
            throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Material has no current version");
        }
        if (!material.getCurrentVersion().getId().equals(version.getId())) {
            throw new ApiException(
                    ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Review can only start on the current version");
        }
        if (reviewCycleRepository
                .findByMaterialIdAndStatus(material.getId(), ReviewCycleStatus.active)
                .isPresent()) {
            throw new ApiException(
                    ErrorCode.CYCLE_ALREADY_ACTIVE, HttpStatus.CONFLICT, "A review cycle is already active");
        }
        validateWorkflowGroupSizes(material);

        Instant now = Instant.now();
        ReviewCycle cycle = DomainEntityFactory.create(ReviewCycle.class);
        cycle.setId(UUID.randomUUID());
        cycle.setMaterial(material);
        cycle.setVersion(version);
        cycle.setStatus(ReviewCycleStatus.active);
        cycle.setCurrentPosition(1);
        cycle.setApprovalLifetimeDays(material.getProduct().getApprovalLifetimeDays());
        cycle.setStartedBy(startedBy);
        cycle.setStartedAt(now);
        reviewCycleRepository.save(cycle);

        List<WorkflowStep> templateSteps =
                workflowStepRepository.findByProductIdOrderByPositionAsc(material.getProduct().getId());
        for (WorkflowStep templateStep : templateSteps) {
            CycleStep cycleStep = DomainEntityFactory.create(CycleStep.class);
            cycleStep.setId(UUID.randomUUID());
            cycleStep.setCycle(cycle);
            cycleStep.setPosition(templateStep.getPosition());
            cycleStep.setName(templateStep.getName());
            if (templateStep.getPosition() == 1) {
                cycleStep.setOpenedAt(now);
            }
            cycleStepRepository.save(cycleStep);

            List<StepRequirement> requirements = stepRequirementRepository.findByStepId(templateStep.getId());
            for (StepRequirement requirement : requirements) {
                CycleRequirement cycleRequirement = DomainEntityFactory.create(CycleRequirement.class);
                cycleRequirement.setId(UUID.randomUUID());
                cycleRequirement.setCycleStep(cycleStep);
                cycleRequirement.setGroup(requirement.getGroup());
                cycleRequirement.setGroupName(requirement.getGroup().getName());
                cycleRequirement.setApprovalsRequired(requirement.getApprovalsRequired());
                cycleRequirementRepository.save(cycleRequirement);
            }
        }

        material.setUpdatedAt(now);
        materialRepository.save(material);

        reviewEventWriter.reviewStarted(material, startedBy, version.getNumber(), now);
        notifyStepOpened(material, startedBy, cycle, 1, now);

        return cycle;
    }

    @Transactional
    public ReviewCycle restartOnNewVersion(Material material, MaterialVersion version, AppUser startedBy) {
        ensureNotObsolete(material);
        if (material.getCurrentVersion() == null
                || !material.getCurrentVersion().getId().equals(version.getId())) {
            throw new ApiException(
                    ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Review can only start on the current version");
        }
        validateWorkflowGroupSizes(material);

        Instant now = Instant.now();
        ReviewCycle cycle = DomainEntityFactory.create(ReviewCycle.class);
        cycle.setId(UUID.randomUUID());
        cycle.setMaterial(material);
        cycle.setVersion(version);
        cycle.setStatus(ReviewCycleStatus.active);
        cycle.setCurrentPosition(1);
        cycle.setApprovalLifetimeDays(material.getProduct().getApprovalLifetimeDays());
        cycle.setStartedBy(startedBy);
        cycle.setStartedAt(now);
        reviewCycleRepository.save(cycle);

        List<WorkflowStep> templateSteps =
                workflowStepRepository.findByProductIdOrderByPositionAsc(material.getProduct().getId());
        for (WorkflowStep templateStep : templateSteps) {
            CycleStep cycleStep = DomainEntityFactory.create(CycleStep.class);
            cycleStep.setId(UUID.randomUUID());
            cycleStep.setCycle(cycle);
            cycleStep.setPosition(templateStep.getPosition());
            cycleStep.setName(templateStep.getName());
            if (templateStep.getPosition() == 1) {
                cycleStep.setOpenedAt(now);
            }
            cycleStepRepository.save(cycleStep);

            List<StepRequirement> requirements = stepRequirementRepository.findByStepId(templateStep.getId());
            for (StepRequirement requirement : requirements) {
                CycleRequirement cycleRequirement = DomainEntityFactory.create(CycleRequirement.class);
                cycleRequirement.setId(UUID.randomUUID());
                cycleRequirement.setCycleStep(cycleStep);
                cycleRequirement.setGroup(requirement.getGroup());
                cycleRequirement.setGroupName(requirement.getGroup().getName());
                cycleRequirement.setApprovalsRequired(requirement.getApprovalsRequired());
                cycleRequirementRepository.save(cycleRequirement);
            }
        }

        material.setUpdatedAt(now);
        materialRepository.save(material);

        reviewEventWriter.reviewRestarted(material, startedBy, version.getNumber(), now);
        notifyStepOpened(material, startedBy, cycle, 1, now);

        return cycle;
    }

    @Transactional
    public void abandonActiveCycle(UUID materialId) {
        reviewCycleRepository
                .findByMaterialIdAndStatus(materialId, ReviewCycleStatus.active)
                .ifPresent(cycle -> {
                    Instant now = Instant.now();
                    cycle.setStatus(ReviewCycleStatus.abandoned);
                    cycle.setEndedAt(now);
                    reviewCycleRepository.saveAndFlush(cycle);
                    Material material = cycle.getMaterial();
                    material.setUpdatedAt(now);
                    materialRepository.save(material);
                });
    }

    @Transactional
    public void approve(UUID materialId, UUID groupId, AppUser approver) {
        Material material =
                materialRepository.findById(materialId).orElseThrow(() -> notFoundMaterial(materialId));
        ensureNotObsolete(material);

        MaterialVersion currentVersion = material.getCurrentVersion();
        if (currentVersion == null) {
            throw new ApiException(ErrorCode.NO_ACTIVE_CYCLE, HttpStatus.CONFLICT, "No active review cycle");
        }

        ReviewCycle cycle = reviewCycleRepository
                .findByMaterialIdAndStatus(materialId, ReviewCycleStatus.active)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.NO_ACTIVE_CYCLE, HttpStatus.CONFLICT, "No active review cycle"));

        if (!cycle.getVersion().getId().equals(currentVersion.getId())) {
            throw new ApiException(ErrorCode.NO_ACTIVE_CYCLE, HttpStatus.CONFLICT, "No active review cycle");
        }

        cycle = reviewCycleRepository.findByIdForUpdate(cycle.getId()).orElseThrow();

        if (cycle.getStatus() != ReviewCycleStatus.active) {
            throw new ApiException(ErrorCode.NO_ACTIVE_CYCLE, HttpStatus.CONFLICT, "No active review cycle");
        }

        int position = cycle.getCurrentPosition();
        List<CycleRequirement> openRequirements = requirementsForPosition(cycle.getId(), position);
        CycleRequirement matchedRequirement = openRequirements.stream()
                .filter(req -> req.getGroup().getId().equals(groupId))
                .findFirst()
                .orElseThrow(() -> new ApiException(
                        ErrorCode.VALIDATION,
                        HttpStatus.BAD_REQUEST,
                        "Group is not required on the open step"));

        boolean member = membershipRepository.findByIdUserId(approver.getId()).stream()
                .anyMatch(m -> m.getId().getGroupId().equals(groupId));
        if (!member) {
            throw new ApiException(ErrorCode.NOT_GROUP_MEMBER, HttpStatus.FORBIDDEN, "Not a member of this group");
        }

        if (reviewRepository
                .findByCycleIdAndPositionAndGroupIdAndUserId(cycle.getId(), position, groupId, approver.getId())
                .isPresent()) {
            throw new ApiException(
                    ErrorCode.ALREADY_APPROVED,
                    HttpStatus.CONFLICT,
                    "Already approved for this group on this step");
        }

        Instant now = Instant.now();
        int countedSoFar = countedApprovals(cycle.getId(), position, groupId);
        boolean counted = countedSoFar < matchedRequirement.getApprovalsRequired();

        Review review = DomainEntityFactory.create(Review.class);
        review.setId(UUID.randomUUID());
        review.setCycle(cycle);
        review.setPosition(position);
        review.setGroup(userGroupRepository.getReferenceById(groupId));
        review.setUser(appUserRepository.getReferenceById(approver.getId()));
        review.setCounted(counted);
        review.setDecidedAt(now);
        reviewRepository.save(review);

        AppUser owner = material.getOwner();
        reviewEventWriter.approved(
                material, appUserRepository.getReferenceById(approver.getId()), owner, matchedRequirement.getGroupName(), position, now);

        material.setUpdatedAt(now);
        materialRepository.save(material);

        if (stepRequirementsMet(cycle.getId(), position)) {
            completeOpenStep(material, cycle, position, approver, now);
        }
    }

    private void completeOpenStep(Material material, ReviewCycle cycle, int position, AppUser actor, Instant now) {
        CycleStep openStep = cycleStepRepository
                .findByCycleIdAndPosition(cycle.getId(), position)
                .orElseThrow();
        openStep.setCompletedAt(now);
        cycleStepRepository.save(openStep);

        AppUser owner = material.getOwner();
        reviewEventWriter.stepCompleted(material, appUserRepository.getReferenceById(actor.getId()), owner, position, openStep.getName(), now.plusMillis(1));

        Optional<CycleStep> nextStep = cycleStepRepository.findByCycleIdOrderByPositionAsc(cycle.getId()).stream()
                .filter(step -> step.getPosition() > position)
                .findFirst();

        if (nextStep.isPresent()) {
            CycleStep step = nextStep.get();
            step.setOpenedAt(now);
            cycleStepRepository.save(step);
            cycle.setCurrentPosition(step.getPosition());
            reviewCycleRepository.save(cycle);
            notifyStepOpened(material, appUserRepository.getReferenceById(actor.getId()), cycle, step.getPosition(), now);
        } else {
            cycle.setStatus(ReviewCycleStatus.completed);
            cycle.setEndedAt(now);
            reviewCycleRepository.save(cycle);

            MaterialVersion approvedVersion = cycle.getVersion();
            material.setApprovedVersion(approvedVersion);
            material.setApprovedAt(now);
            material.setApprovedUntil(now.plus(cycle.getApprovalLifetimeDays(), ChronoUnit.DAYS));
            material.setExpiryNotifiedAt(null);
            material.setUpdatedAt(now);
            materialRepository.save(material);

            reviewEventWriter.fullyApproved(
                    material,
                    appUserRepository.getReferenceById(actor.getId()),
                    owner,
                    approvedVersion.getNumber(),
                    material.getApprovedUntil(),
                    now.plusMillis(2));
        }
    }

    private void notifyStepOpened(
            Material material, AppUser actor, ReviewCycle cycle, int stepPosition, Instant now) {
        Set<UUID> recipientIds = new HashSet<>();
        for (CycleRequirement requirement : requirementsForPosition(cycle.getId(), stepPosition)) {
            for (Membership membership : membershipRepository.findByIdGroupId(requirement.getGroup().getId())) {
                recipientIds.add(membership.getId().getUserId());
            }
        }
        String stepName = cycleStepRepository
                .findByCycleIdAndPosition(cycle.getId(), stepPosition)
                .map(CycleStep::getName)
                .orElse("Step " + stepPosition);
        reviewEventWriter.stepOpened(material, actor, stepPosition, stepName, recipientIds, now.plusMillis(2));
    }

    private void validateWorkflowGroupSizes(Material material) {
        List<WorkflowStep> steps =
                workflowStepRepository.findByProductIdOrderByPositionAsc(material.getProduct().getId());
        for (WorkflowStep step : steps) {
            for (StepRequirement requirement : stepRequirementRepository.findByStepId(step.getId())) {
                UUID groupId = requirement.getGroup().getId();
                long memberCount = membershipRepository.findByIdGroupId(groupId).size();
                if (memberCount < requirement.getApprovalsRequired()) {
                    UserGroup group = requirement.getGroup();
                    throw new ApiException(
                            ErrorCode.GROUP_TOO_SMALL,
                            HttpStatus.CONFLICT,
                            "Group has too few members",
                            Map.of("groupName", group.getName()));
                }
            }
        }
    }

    private boolean stepRequirementsMet(UUID cycleId, int position) {
        for (CycleRequirement requirement : requirementsForPosition(cycleId, position)) {
            int have = countedApprovals(cycleId, position, requirement.getGroup().getId());
            if (have < requirement.getApprovalsRequired()) {
                return false;
            }
        }
        return true;
    }

    private int countedApprovals(UUID cycleId, int position, UUID groupId) {
        return (int) reviewRepository.findByCycleIdAndPositionAndGroupId(cycleId, position, groupId).stream()
                .filter(Review::isCounted)
                .count();
    }

    private List<CycleRequirement> requirementsForPosition(UUID cycleId, int position) {
        return cycleStepRepository
                .findByCycleIdAndPosition(cycleId, position)
                .map(step -> cycleRequirementRepository.findByCycleStepId(step.getId()))
                .orElse(List.of());
    }

    private void ensureNotObsolete(Material material) {
        if (material.getObsoleteAt() != null) {
            throw new ApiException(ErrorCode.MATERIAL_OBSOLETE, HttpStatus.CONFLICT, "Material is obsolete");
        }
    }

    private static ApiException notFoundMaterial(UUID materialId) {
        return new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Material not found");
    }
}
