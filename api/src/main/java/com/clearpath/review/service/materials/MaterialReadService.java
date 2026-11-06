package com.clearpath.review.service.materials;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.Activity;
import com.clearpath.review.domain.ActivityRepository;
import com.clearpath.review.domain.Comment;
import com.clearpath.review.domain.CommentRepository;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialChannel;
import com.clearpath.review.domain.MaterialRepository;
import com.clearpath.review.domain.MaterialVersion;
import com.clearpath.review.domain.MaterialVersionRepository;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import com.clearpath.review.web.materials.dto.ActivityEntryDto;
import com.clearpath.review.web.materials.dto.CommentDto;
import com.clearpath.review.web.materials.dto.MaterialDetailDto;
import com.clearpath.review.web.materials.dto.MaterialSummaryDto;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MaterialReadService {

    private final MaterialReadQueryRepository materialReadQueryRepository;
    private final MaterialRepository materialRepository;
    private final MaterialVersionRepository materialVersionRepository;
    private final MaterialViewService materialViewService;
    private final CommentRepository commentRepository;
    private final ActivityRepository activityRepository;

    public MaterialReadService(
            MaterialReadQueryRepository materialReadQueryRepository,
            MaterialRepository materialRepository,
            MaterialVersionRepository materialVersionRepository,
            MaterialViewService materialViewService,
            CommentRepository commentRepository,
            ActivityRepository activityRepository) {
        this.materialReadQueryRepository = materialReadQueryRepository;
        this.materialRepository = materialRepository;
        this.materialVersionRepository = materialVersionRepository;
        this.materialViewService = materialViewService;
        this.commentRepository = commentRepository;
        this.activityRepository = activityRepository;
    }

    @Transactional(readOnly = true)
    public List<MaterialSummaryDto> listMaterials(
            CurrentUser viewer,
            String q,
            UUID productId,
            MaterialStatus status,
            MaterialChannel channel,
            Boolean owned,
            Boolean favorites) {
        return materialReadQueryRepository.listMaterials(viewer.id(), q, productId, status, channel, owned, favorites);
    }

    @Transactional(readOnly = true)
    public MaterialDetailDto getMaterial(UUID materialId, UUID versionId, CurrentUser viewer) {
        Material material = materialRepository
                .findById(materialId)
                .orElseThrow(() -> notFound("Material not found"));
        List<MaterialVersion> versions = materialVersionRepository.findByMaterialIdOrderByNumberAsc(materialId);
        UUID selectedVersionId = resolveSelectedVersionId(material, versionId, versions);
        return materialViewService.buildDetail(material, versions, selectedVersionId, viewer);
    }

    @Transactional(readOnly = true)
    public VersionFileContent getVersionFileContent(UUID versionId) {
        MaterialVersion version = materialVersionRepository
                .findById(versionId)
                .orElseThrow(() -> notFound("Version not found"));
        var file = version.getFile();
        return new VersionFileContent(file.getBytes(), file.getSize(), version.getFileName());
    }

    @Transactional(readOnly = true)
    public List<CommentDto> listVersionComments(UUID versionId) {
        if (!materialVersionRepository.existsById(versionId)) {
            throw notFound("Version not found");
        }
        return commentRepository.findByVersionIdOrderByCreatedAtAsc(versionId).stream()
                .map(this::toCommentDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ActivityEntryDto> listMaterialActivity(UUID materialId) {
        if (!materialRepository.existsById(materialId)) {
            throw notFound("Material not found");
        }
        return activityRepository.findByMaterialIdOrderByCreatedAtDesc(materialId).stream()
                .map(this::toActivityDto)
                .toList();
    }

    private UUID resolveSelectedVersionId(Material material, UUID versionId, List<MaterialVersion> versions) {
        if (versionId != null) {
            boolean belongs = versions.stream().anyMatch(version -> version.getId().equals(versionId));
            if (!belongs) {
                throw notFound("Version not found");
            }
            return versionId;
        }
        if (material.getCurrentVersion() == null) {
            throw notFound("Material has no versions");
        }
        return material.getCurrentVersion().getId();
    }

    private CommentDto toCommentDto(Comment comment) {
        return new CommentDto(
                comment.getId(),
                comment.getVersion().getId(),
                comment.getAuthor().getId(),
                comment.getAuthor().getName(),
                comment.getBody(),
                comment.getCreatedAt());
    }

    private ActivityEntryDto toActivityDto(Activity activity) {
        return new ActivityEntryDto(
                activity.getId(),
                activity.getMaterial().getId(),
                activity.getActor().getId(),
                activity.getActor().getName(),
                activity.getType(),
                activity.getDetail(),
                activity.getCreatedAt());
    }

    private static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }
}
