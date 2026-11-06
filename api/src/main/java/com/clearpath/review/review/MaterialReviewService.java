package com.clearpath.review.review;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialRepository;
import com.clearpath.review.domain.MaterialVersion;
import com.clearpath.review.domain.MaterialVersionRepository;
import com.clearpath.review.service.materials.MaterialViewService;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import com.clearpath.review.web.materials.dto.MaterialDetailDto;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MaterialReviewService {

    private final MaterialRepository materialRepository;
    private final MaterialVersionRepository materialVersionRepository;
    private final AppUserRepository appUserRepository;
    private final ReviewEngine reviewEngine;
    private final MaterialViewService materialViewService;

    public MaterialReviewService(
            MaterialRepository materialRepository,
            MaterialVersionRepository materialVersionRepository,
            AppUserRepository appUserRepository,
            ReviewEngine reviewEngine,
            MaterialViewService materialViewService) {
        this.materialRepository = materialRepository;
        this.materialVersionRepository = materialVersionRepository;
        this.appUserRepository = appUserRepository;
        this.reviewEngine = reviewEngine;
        this.materialViewService = materialViewService;
    }

    @Transactional
    public MaterialDetailDto startReview(UUID materialId, CurrentUser viewer) {
        Material material = materialRepository
                .findById(materialId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Material not found"));
        MaterialVersion version = material.getCurrentVersion();
        if (version == null) {
            throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Material has no current version");
        }
        var startedBy = appUserRepository.getReferenceById(viewer.id());
        reviewEngine.startCycle(material, version, startedBy);
        return materialDetail(materialId, viewer);
    }

    @Transactional
    public MaterialDetailDto approve(UUID materialId, UUID groupId, CurrentUser viewer) {
        if (!materialRepository.existsById(materialId)) {
            throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Material not found");
        }
        var approver = appUserRepository.getReferenceById(viewer.id());
        reviewEngine.approve(materialId, groupId, approver);
        return materialDetail(materialId, viewer);
    }

    private MaterialDetailDto materialDetail(UUID materialId, CurrentUser viewer) {
        Material material = materialRepository.findById(materialId).orElseThrow();
        List<MaterialVersion> versions = materialVersionRepository.findByMaterialIdOrderByNumberAsc(materialId);
        UUID selectedVersionId = material.getCurrentVersion().getId();
        return materialViewService.buildDetail(material, versions, selectedVersionId, viewer);
    }
}
