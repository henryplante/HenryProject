package com.clearpath.review.service.materials;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.CycleRequirement;
import com.clearpath.review.domain.CycleStep;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialVersion;
import com.clearpath.review.domain.MembershipRepository;
import com.clearpath.review.domain.Review;
import com.clearpath.review.domain.ReviewCycle;
import com.clearpath.review.domain.ReviewCycleRepository;
import com.clearpath.review.domain.ReviewCycleStatus;
import com.clearpath.review.domain.ReviewRepository;
import com.clearpath.review.domain.StepRequirement;
import com.clearpath.review.domain.StepRequirementRepository;
import com.clearpath.review.domain.WorkflowStep;
import com.clearpath.review.domain.WorkflowStepRepository;
import com.clearpath.review.domain.CycleRequirementRepository;
import com.clearpath.review.domain.CycleStepRepository;
import com.clearpath.review.domain.FavoriteRepository;
import com.clearpath.review.web.materials.dto.ApprovableGroupDto;
import com.clearpath.review.web.materials.dto.CycleRequirementViewDto;
import com.clearpath.review.web.materials.dto.CycleStepStateDto;
import com.clearpath.review.web.materials.dto.CycleStepViewDto;
import com.clearpath.review.web.materials.dto.CycleStatusDto;
import com.clearpath.review.web.materials.dto.CycleViewDto;
import com.clearpath.review.web.materials.dto.MaterialDetailDto;
import com.clearpath.review.web.materials.dto.MaterialSummaryDto;
import com.clearpath.review.web.materials.dto.VersionSummaryDto;
import com.clearpath.review.web.materials.dto.ViewerCapabilitiesDto;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class MaterialViewService {

    private final MaterialReadQueryRepository materialReadQueryRepository;
    private final ReviewCycleRepository reviewCycleRepository;
    private final CycleStepRepository cycleStepRepository;
    private final CycleRequirementRepository cycleRequirementRepository;
    private final ReviewRepository reviewRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final StepRequirementRepository stepRequirementRepository;
    private final MembershipRepository membershipRepository;
    private final FavoriteRepository favoriteRepository;

    public MaterialViewService(
            MaterialReadQueryRepository materialReadQueryRepository,
            ReviewCycleRepository reviewCycleRepository,
            CycleStepRepository cycleStepRepository,
            CycleRequirementRepository cycleRequirementRepository,
            ReviewRepository reviewRepository,
            WorkflowStepRepository workflowStepRepository,
            StepRequirementRepository stepRequirementRepository,
            MembershipRepository membershipRepository,
            FavoriteRepository favoriteRepository) {
        this.materialReadQueryRepository = materialReadQueryRepository;
        this.reviewCycleRepository = reviewCycleRepository;
        this.cycleStepRepository = cycleStepRepository;
        this.cycleRequirementRepository = cycleRequirementRepository;
        this.reviewRepository = reviewRepository;
        this.workflowStepRepository = workflowStepRepository;
        this.stepRequirementRepository = stepRequirementRepository;
        this.membershipRepository = membershipRepository;
        this.favoriteRepository = favoriteRepository;
    }

    public MaterialSummaryDto buildSummary(Material material, CurrentUser viewer) {
        MaterialStatus status = materialReadQueryRepository.loadMaterialStatus(material.getId());
        boolean favorited = favoriteRepository.existsByIdUserIdAndIdMaterialId(viewer.id(), material.getId());
        Instant approvedUntil = material.getApprovedUntil();
        if (status != MaterialStatus.approved && status != MaterialStatus.expired) {
            approvedUntil = null;
        }
        int currentVersionNumber =
                material.getCurrentVersion() != null ? material.getCurrentVersion().getNumber() : 0;
        return new MaterialSummaryDto(
                material.getId(),
                material.getTitle(),
                material.getProduct().getId(),
                material.getProduct().getName(),
                material.getChannel(),
                status,
                material.getOwner().getId(),
                currentVersionNumber,
                favorited,
                approvedUntil);
    }

    public MaterialDetailDto buildDetail(
            Material material, List<MaterialVersion> versions, UUID selectedVersionId, CurrentUser viewer) {
        MaterialSummaryDto summary = buildSummary(material, viewer);
        Map<UUID, VersionStatus> versionStatuses = materialReadQueryRepository.loadVersionStatuses(material.getId());
        UUID approvedVersionId =
                material.getApprovedVersion() != null ? material.getApprovedVersion().getId() : null;
        Instant materialApprovedUntil = material.getApprovedUntil();

        List<VersionSummaryDto> versionSummaries = versions.stream()
                .sorted(Comparator.comparingInt(MaterialVersion::getNumber))
                .map(version -> {
                    VersionStatus versionStatus =
                            versionStatuses.getOrDefault(version.getId(), VersionStatus.draft);
                    Instant approvedUntil = null;
                    if (version.getId().equals(approvedVersionId)) {
                        approvedUntil = materialApprovedUntil;
                    }
                    return new VersionSummaryDto(
                            version.getId(),
                            version.getNumber(),
                            version.getUploadedAt(),
                            version.getUploadedBy().getName(),
                            versionStatus,
                            approvedUntil);
                })
                .toList();

        CycleViewDto cycle = buildCycleForVersion(selectedVersionId).orElse(null);
        ViewerCapabilitiesDto capabilities = buildCapabilities(material, selectedVersionId, viewer);

        return new MaterialDetailDto(
                summary.id(),
                summary.title(),
                summary.productId(),
                summary.productName(),
                summary.channel(),
                summary.status(),
                summary.ownerId(),
                summary.currentVersionNumber(),
                summary.favorited(),
                summary.approvedUntil(),
                material.getAudience(),
                material.getIntendedUse(),
                versionSummaries,
                selectedVersionId,
                cycle,
                capabilities);
    }

    public Optional<CycleViewDto> buildCycleForVersion(UUID versionId) {
        Optional<ReviewCycle> cycle = reviewCycleRepository.findByVersionIdAndStatus(versionId, ReviewCycleStatus.active);
        if (cycle.isEmpty()) {
            cycle = reviewCycleRepository
                    .findFirstByVersionIdAndStatusOrderByEndedAtDescStartedAtDesc(versionId, ReviewCycleStatus.completed);
        }
        return cycle.map(this::toCycleView);
    }

    public ViewerCapabilitiesDto buildCapabilities(Material material, UUID selectedVersionId, CurrentUser viewer) {
        boolean canStartReview = false;
        String startBlockedReason = null;

        UUID currentVersionId =
                material.getCurrentVersion() != null ? material.getCurrentVersion().getId() : null;
        boolean currentVersionSelected =
                currentVersionId != null && currentVersionId.equals(selectedVersionId);

        if (material.getObsoleteAt() != null) {
            startBlockedReason = "Material is obsolete";
        } else if (currentVersionId == null) {
            startBlockedReason = "No file uploaded";
        } else if (!currentVersionSelected) {
            startBlockedReason = "Select the current version to start review";
        } else if (reviewCycleRepository
                .findByMaterialIdAndStatus(material.getId(), ReviewCycleStatus.active)
                .isPresent()) {
            startBlockedReason = "A review cycle is already active";
        } else {
            Optional<String> groupTooSmall = findStartReviewGroupTooSmall(material);
            if (groupTooSmall.isPresent()) {
                startBlockedReason = "Group has too few members: " + groupTooSmall.get();
            } else {
                canStartReview = true;
            }
        }

        List<ApprovableGroupDto> approvableGroups = new ArrayList<>();
        if (currentVersionId != null) {
            reviewCycleRepository
                    .findByVersionIdAndStatus(currentVersionId, ReviewCycleStatus.active)
                    .ifPresent(activeCycle -> {
                        int openPosition = activeCycle.getCurrentPosition();
                        List<CycleRequirement> requirements = requirementsForPosition(activeCycle.getId(), openPosition);
                        for (CycleRequirement requirement : requirements) {
                            UUID groupId = requirement.getGroup().getId();
                            if (!viewer.groupIds().contains(groupId)) {
                                continue;
                            }
                            if (reviewRepository
                                    .findByCycleIdAndPositionAndGroupIdAndUserId(
                                            activeCycle.getId(), openPosition, groupId, viewer.id())
                                    .isPresent()) {
                                continue;
                            }
                            approvableGroups.add(
                                    new ApprovableGroupDto(groupId, requirement.getGroupName()));
                        }
                    });
        }

        return new ViewerCapabilitiesDto(
                canStartReview, startBlockedReason, !approvableGroups.isEmpty(), approvableGroups);
    }

    private Optional<String> findStartReviewGroupTooSmall(Material material) {
        List<WorkflowStep> steps =
                workflowStepRepository.findByProductIdOrderByPositionAsc(material.getProduct().getId());
        if (steps.isEmpty()) {
            return Optional.empty();
        }
        WorkflowStep firstStep = steps.getFirst();
        List<StepRequirement> requirements = stepRequirementRepository.findByStepId(firstStep.getId());
        for (StepRequirement requirement : requirements) {
            UUID groupId = requirement.getGroup().getId();
            long memberCount = membershipRepository.findByIdGroupId(groupId).size();
            if (memberCount < requirement.getApprovalsRequired()) {
                return Optional.of(requirement.getGroup().getName());
            }
        }
        return Optional.empty();
    }

    private List<CycleRequirement> requirementsForPosition(UUID cycleId, int position) {
        return cycleStepRepository
                .findByCycleIdAndPosition(cycleId, position)
                .map(step -> cycleRequirementRepository.findByCycleStepId(step.getId()))
                .orElse(List.of());
    }

    private CycleViewDto toCycleView(ReviewCycle cycle) {
        CycleStatusDto status =
                cycle.getStatus() == ReviewCycleStatus.active ? CycleStatusDto.active : CycleStatusDto.completed;
        int currentPosition = cycle.getCurrentPosition();
        List<CycleStep> steps = cycleStepRepository.findByCycleIdOrderByPositionAsc(cycle.getId());
        List<Review> cycleReviews = reviewRepository.findByCycleId(cycle.getId());

        List<CycleStepViewDto> stepViews = steps.stream()
                .map(step -> {
                    CycleStepStateDto state = stepState(cycle, step, currentPosition);
                    List<CycleRequirementViewDto> requirementViews =
                            cycleRequirementRepository.findByCycleStepId(step.getId()).stream()
                                    .map(req -> requirementView(req, cycleReviews, step.getPosition()))
                                    .toList();
                    return new CycleStepViewDto(step.getPosition(), step.getName(), state, requirementViews);
                })
                .toList();

        return new CycleViewDto(status, currentPosition, stepViews);
    }

    private CycleStepStateDto stepState(ReviewCycle cycle, CycleStep step, int currentPosition) {
        if (cycle.getStatus() == ReviewCycleStatus.completed) {
            return CycleStepStateDto.completed;
        }
        if (step.getPosition() < currentPosition) {
            return CycleStepStateDto.completed;
        }
        if (step.getPosition() == currentPosition) {
            return CycleStepStateDto.active;
        }
        return CycleStepStateDto.pending;
    }

    private CycleRequirementViewDto requirementView(
            CycleRequirement requirement, List<Review> cycleReviews, int stepPosition) {
        UUID groupId = requirement.getGroup().getId();
        int have = (int) cycleReviews.stream()
                .filter(review -> review.getPosition() == stepPosition)
                .filter(review -> review.getGroup().getId().equals(groupId))
                .filter(Review::isCounted)
                .count();
        return new CycleRequirementViewDto(groupId, requirement.getGroupName(), have, requirement.getApprovalsRequired());
    }
}
