package com.clearpath.review.web.review;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.review.MaterialReviewService;
import com.clearpath.review.web.materials.dto.MaterialDetailDto;
import com.clearpath.review.web.review.dto.ApproveRequestDto;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/materials/{id}")
public class MaterialReviewController {

    private final MaterialReviewService materialReviewService;

    public MaterialReviewController(MaterialReviewService materialReviewService) {
        this.materialReviewService = materialReviewService;
    }

    @PostMapping("/review/start")
    public MaterialDetailDto startReview(@PathVariable("id") UUID materialId, CurrentUser viewer) {
        return materialReviewService.startReview(materialId, viewer);
    }

    @PostMapping("/approvals")
    public MaterialDetailDto approve(
            @PathVariable("id") UUID materialId,
            CurrentUser viewer,
            @Valid @RequestBody ApproveRequestDto body) {
        return materialReviewService.approve(materialId, body.groupId(), viewer);
    }
}
