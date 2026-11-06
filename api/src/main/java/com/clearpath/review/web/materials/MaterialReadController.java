package com.clearpath.review.web.materials;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.MaterialChannel;
import com.clearpath.review.service.materials.MaterialReadService;
import com.clearpath.review.service.materials.VersionFileContent;
import com.clearpath.review.service.materials.MaterialStatus;
import com.clearpath.review.web.materials.dto.ActivityEntryDto;
import com.clearpath.review.web.materials.dto.CommentDto;
import com.clearpath.review.web.materials.dto.MaterialDetailDto;
import com.clearpath.review.web.materials.dto.MaterialSummaryDto;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MaterialReadController {

    private final MaterialReadService materialReadService;

    public MaterialReadController(MaterialReadService materialReadService) {
        this.materialReadService = materialReadService;
    }

    @GetMapping("/materials")
    public List<MaterialSummaryDto> listMaterials(
            CurrentUser viewer,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID productId,
            @RequestParam(required = false) MaterialStatus status,
            @RequestParam(required = false) MaterialChannel channel,
            @RequestParam(required = false) Boolean owned,
            @RequestParam(required = false) Boolean favorites) {
        return materialReadService.listMaterials(viewer, q, productId, status, channel, owned, favorites);
    }

    @GetMapping("/materials/{id}")
    public MaterialDetailDto getMaterial(
            CurrentUser viewer,
            @PathVariable UUID id,
            @RequestParam(required = false) UUID versionId) {
        return materialReadService.getMaterial(id, versionId, viewer);
    }

    @GetMapping("/versions/{versionId}/file")
    public ResponseEntity<byte[]> getVersionFile(@PathVariable UUID versionId) {
        VersionFileContent file = materialReadService.getVersionFileContent(versionId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentLength(file.size());
        headers.setContentDisposition(
                ContentDisposition.inline().filename(file.fileName()).build());
        return ResponseEntity.ok().headers(headers).body(file.bytes());
    }

    @GetMapping("/versions/{versionId}/comments")
    public List<CommentDto> listVersionComments(@PathVariable UUID versionId) {
        return materialReadService.listVersionComments(versionId);
    }

    @GetMapping("/materials/{id}/activity")
    public List<ActivityEntryDto> listMaterialActivity(@PathVariable UUID id) {
        return materialReadService.listMaterialActivity(id);
    }
}
