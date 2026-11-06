package com.clearpath.review.web.materials;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.MaterialAudience;
import com.clearpath.review.domain.MaterialChannel;
import com.clearpath.review.service.materials.MaterialWriteService;
import com.clearpath.review.web.materials.dto.MaterialDetailDto;
import com.clearpath.review.web.materials.dto.MaterialPatchDto;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class MaterialWriteController {

    private final MaterialWriteService materialWriteService;

    public MaterialWriteController(MaterialWriteService materialWriteService) {
        this.materialWriteService = materialWriteService;
    }

    @PostMapping("/materials")
    @ResponseStatus(HttpStatus.CREATED)
    public MaterialDetailDto createMaterial(
            CurrentUser viewer,
            @RequestParam String title,
            @RequestParam UUID productId,
            @RequestParam MaterialChannel channel,
            @RequestParam MaterialAudience audience,
            @RequestParam String intendedUse,
            @RequestParam MultipartFile file,
            @RequestParam(required = false, defaultValue = "false") Boolean startReview) {
        return materialWriteService.createMaterial(
                title, productId, channel, audience, intendedUse, file, startReview, viewer);
    }

    @PostMapping("/materials/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public MaterialDetailDto uploadVersion(
            CurrentUser viewer,
            @PathVariable("id") UUID materialId,
            @RequestParam MultipartFile file,
            @RequestParam(required = false) String note,
            @RequestParam(required = false) Boolean startReview) {
        return materialWriteService.uploadVersion(materialId, file, note, startReview, viewer);
    }

    @PatchMapping("/materials/{id}")
    public MaterialDetailDto patchMaterial(
            CurrentUser viewer, @PathVariable("id") UUID materialId, @RequestBody MaterialPatchDto patch) {
        return materialWriteService.patchMaterial(materialId, patch, viewer);
    }

    @PostMapping("/materials/{id}/obsolete")
    public MaterialDetailDto markObsolete(@PathVariable("id") UUID materialId, CurrentUser viewer) {
        return materialWriteService.markObsolete(materialId, viewer);
    }
}
