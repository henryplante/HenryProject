package com.clearpath.review.service.materials;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.FileBlob;
import com.clearpath.review.domain.FileBlobRepository;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialAudience;
import com.clearpath.review.domain.MaterialChannel;
import com.clearpath.review.domain.MaterialRepository;
import com.clearpath.review.domain.MaterialVersion;
import com.clearpath.review.domain.MaterialVersionRepository;
import com.clearpath.review.domain.Product;
import com.clearpath.review.domain.ProductRepository;
import com.clearpath.review.domain.ReviewCycleRepository;
import com.clearpath.review.domain.ReviewCycleStatus;
import com.clearpath.review.review.DomainEntityFactory;
import com.clearpath.review.review.ReviewEngine;
import com.clearpath.review.review.events.ReviewEventWriter;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import com.clearpath.review.web.materials.dto.MaterialDetailDto;
import com.clearpath.review.web.materials.dto.MaterialPatchDto;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MaterialWriteService {

    private static final byte[] PDF_MAGIC = "%PDF".getBytes(StandardCharsets.US_ASCII);

    private final MaterialRepository materialRepository;
    private final MaterialVersionRepository materialVersionRepository;
    private final ProductRepository productRepository;
    private final AppUserRepository appUserRepository;
    private final FileBlobRepository fileBlobRepository;
    private final ReviewCycleRepository reviewCycleRepository;
    private final ReviewEngine reviewEngine;
    private final ReviewEventWriter reviewEventWriter;
    private final MaterialViewService materialViewService;

    public MaterialWriteService(
            MaterialRepository materialRepository,
            MaterialVersionRepository materialVersionRepository,
            ProductRepository productRepository,
            AppUserRepository appUserRepository,
            FileBlobRepository fileBlobRepository,
            ReviewCycleRepository reviewCycleRepository,
            ReviewEngine reviewEngine,
            ReviewEventWriter reviewEventWriter,
            MaterialViewService materialViewService) {
        this.materialRepository = materialRepository;
        this.materialVersionRepository = materialVersionRepository;
        this.productRepository = productRepository;
        this.appUserRepository = appUserRepository;
        this.fileBlobRepository = fileBlobRepository;
        this.reviewCycleRepository = reviewCycleRepository;
        this.reviewEngine = reviewEngine;
        this.reviewEventWriter = reviewEventWriter;
        this.materialViewService = materialViewService;
    }

    @Transactional
    public MaterialDetailDto createMaterial(
            String title,
            UUID productId,
            MaterialChannel channel,
            MaterialAudience audience,
            String intendedUse,
            MultipartFile file,
            Boolean startReview,
            CurrentUser actor) {
        validateCreateFields(title, productId, channel, audience, intendedUse, file);
        byte[] bytes = readBytes(file);
        validatePdf(file.getContentType(), bytes);

        Product product = productRepository
                .findById(productId)
                .orElseThrow(() -> notFound("Product not found"));
        AppUser owner = appUserRepository
                .findById(actor.id())
                .orElseThrow(() -> notFound("User not found"));

        Instant now = Instant.now();
        FileBlob blob = storeBlob(bytes, file.getContentType(), now);

        Material material = DomainEntityFactory.create(Material.class);
        material.setId(UUID.randomUUID());
        material.setProduct(product);
        material.setOwner(owner);
        material.setTitle(title.trim());
        material.setChannel(channel);
        material.setAudience(audience);
        material.setIntendedUse(intendedUse.trim());
        material.setCreatedAt(now);
        material.setUpdatedAt(now);
        materialRepository.saveAndFlush(material);

        MaterialVersion version = newVersion(
                material, 1, blob, originalFilename(file), owner, now, null);
        material.setCurrentVersion(version);
        materialRepository.saveAndFlush(material);

        reviewEventWriter.uploaded(material, owner, 1, now);

        if (Boolean.TRUE.equals(startReview)) {
            reviewEngine.startCycle(material, version, owner);
        }

        return materialDetail(material.getId(), version.getId(), actor);
    }

    @Transactional
    public MaterialDetailDto uploadVersion(
            UUID materialId,
            MultipartFile file,
            String note,
            Boolean startReview,
            CurrentUser actor) {
        if (file == null || file.isEmpty()) {
            throw validation("File is required");
        }
        byte[] bytes = readBytes(file);
        validatePdf(file.getContentType(), bytes);

        Material material = materialRepository
                .findByIdForUpdate(materialId)
                .orElseThrow(() -> notFound("Material not found"));
        ensureNotObsolete(material);

        AppUser uploader = appUserRepository
                .findById(actor.id())
                .orElseThrow(() -> notFound("User not found"));

        boolean hadActiveCycle = reviewCycleRepository
                .findByMaterialIdAndStatus(materialId, ReviewCycleStatus.active)
                .isPresent();

        Instant now = Instant.now();
        FileBlob blob = storeBlob(bytes, file.getContentType(), now);

        int nextNumber = materialVersionRepository.findByMaterialIdOrderByNumberDesc(materialId).stream()
                .findFirst()
                .map(v -> v.getNumber() + 1)
                .orElse(1);

        MaterialVersion version = newVersion(
                material,
                nextNumber,
                blob,
                originalFilename(file),
                uploader,
                now,
                StringUtils.hasText(note) ? note.trim() : null);
        material.setCurrentVersion(version);
        material.setUpdatedAt(now);
        materialRepository.saveAndFlush(material);

        reviewEventWriter.uploaded(material, uploader, nextNumber, now);

        if (hadActiveCycle) {
            reviewEngine.abandonActiveCycle(materialId);
            reviewEngine.restartOnNewVersion(material, version, uploader);
        } else if (startReview == null ? false : startReview) {
            reviewEngine.startCycle(material, version, uploader);
        }

        return materialDetail(materialId, version.getId(), actor);
    }

    @Transactional
    public MaterialDetailDto patchMaterial(UUID materialId, MaterialPatchDto patch, CurrentUser actor) {
        Material material = materialRepository
                .findById(materialId)
                .orElseThrow(() -> notFound("Material not found"));
        ensureNotObsolete(material);

        AppUser actorEntity = appUserRepository.getReferenceById(actor.id());
        Instant now = Instant.now();
        boolean changed = false;

        if (patch.title() != null) {
            if (!StringUtils.hasText(patch.title())) {
                throw validation("Title is required");
            }
            material.setTitle(patch.title().trim());
            changed = true;
        }
        if (patch.channel() != null) {
            material.setChannel(patch.channel());
            changed = true;
        }
        if (patch.audience() != null) {
            material.setAudience(patch.audience());
            changed = true;
        }
        if (patch.intendedUse() != null) {
            if (!StringUtils.hasText(patch.intendedUse())) {
                throw validation("Intended use is required");
            }
            material.setIntendedUse(patch.intendedUse().trim());
            changed = true;
        }
        if (patch.productId() != null) {
            UUID newProductId = patch.productId();
            if (!newProductId.equals(material.getProduct().getId())) {
                if (!reviewCycleRepository.findByMaterialId(materialId).isEmpty()) {
                    throw new ApiException(
                            ErrorCode.PRODUCT_LOCKED,
                            HttpStatus.CONFLICT,
                            "Product cannot change after review started");
                }
                Product newProduct = productRepository
                        .findById(newProductId)
                        .orElseThrow(() -> notFound("Product not found"));
                String fromName = material.getProduct().getName();
                material.setProduct(newProduct);
                reviewEventWriter.productChanged(material, actorEntity, fromName, newProduct.getName(), now);
                changed = true;
            }
        }
        if (patch.ownerId() != null) {
            UUID newOwnerId = patch.ownerId();
            if (!newOwnerId.equals(material.getOwner().getId())) {
                AppUser newOwner = appUserRepository
                        .findById(newOwnerId)
                        .orElseThrow(() -> notFound("User not found"));
                String fromName = material.getOwner().getName();
                material.setOwner(newOwner);
                reviewEventWriter.ownerChanged(material, actorEntity, fromName, newOwner.getName(), now);
                changed = true;
            }
        }

        if (changed) {
            material.setUpdatedAt(now);
            materialRepository.save(material);
        }

        UUID selectedVersionId = material.getCurrentVersion().getId();
        return materialDetail(materialId, selectedVersionId, actor);
    }

    @Transactional
    public MaterialDetailDto markObsolete(UUID materialId, CurrentUser actor) {
        Material material = materialRepository
                .findById(materialId)
                .orElseThrow(() -> notFound("Material not found"));
        if (material.getObsoleteAt() != null) {
            throw new ApiException(ErrorCode.MATERIAL_OBSOLETE, HttpStatus.CONFLICT, "Material is obsolete");
        }

        AppUser actorEntity = appUserRepository
                .findById(actor.id())
                .orElseThrow(() -> notFound("User not found"));
        Instant now = Instant.now();

        reviewEngine.abandonActiveCycle(materialId);
        material.setObsoleteAt(now);
        material.setUpdatedAt(now);
        materialRepository.save(material);

        reviewEventWriter.obsolete(material, actorEntity, material.getOwner(), now);

        UUID selectedVersionId =
                material.getCurrentVersion() != null ? material.getCurrentVersion().getId() : null;
        if (selectedVersionId == null) {
            throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Material has no current version");
        }
        return materialDetail(materialId, selectedVersionId, actor);
    }

    private MaterialVersion newVersion(
            Material material,
            int number,
            FileBlob blob,
            String fileName,
            AppUser uploadedBy,
            Instant uploadedAt,
            String note) {
        MaterialVersion version = DomainEntityFactory.create(MaterialVersion.class);
        version.setId(UUID.randomUUID());
        version.setMaterial(material);
        version.setNumber(number);
        version.setFile(blob);
        version.setFileName(fileName);
        version.setUploadedBy(uploadedBy);
        version.setUploadedAt(uploadedAt);
        version.setNote(note);
        return materialVersionRepository.saveAndFlush(version);
    }

    private FileBlob storeBlob(byte[] bytes, String contentType, Instant createdAt) {
        FileBlob blob = DomainEntityFactory.create(FileBlob.class);
        blob.setId(UUID.randomUUID());
        blob.setContentType(contentType != null ? contentType : "application/pdf");
        blob.setBytes(bytes);
        blob.setSize(bytes.length);
        blob.setSha256(sha256Hex(bytes));
        blob.setCreatedAt(createdAt);
        return fileBlobRepository.save(blob);
    }

    private static void validateCreateFields(
            String title,
            UUID productId,
            MaterialChannel channel,
            MaterialAudience audience,
            String intendedUse,
            MultipartFile file) {
        if (!StringUtils.hasText(title)) {
            throw validation("Title is required");
        }
        if (productId == null) {
            throw validation("Product is required");
        }
        if (channel == null) {
            throw validation("Channel is required");
        }
        if (audience == null) {
            throw validation("Audience is required");
        }
        if (!StringUtils.hasText(intendedUse)) {
            throw validation("Intended use is required");
        }
        if (file == null || file.isEmpty()) {
            throw validation("File is required");
        }
    }

    private static void validatePdf(String contentType, byte[] bytes) {
        if (contentType == null || !contentType.toLowerCase().startsWith("application/pdf")) {
            throw validation("File must be a PDF");
        }
        if (bytes.length < PDF_MAGIC.length) {
            throw validation("File must be a PDF");
        }
        for (int i = 0; i < PDF_MAGIC.length; i++) {
            if (bytes[i] != PDF_MAGIC[i]) {
                throw validation("File must be a PDF");
            }
        }
    }

    private static byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception e) {
            throw validation("Could not read uploaded file");
        }
    }

    private static String originalFilename(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (!StringUtils.hasText(name)) {
            return "upload.pdf";
        }
        return name;
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private MaterialDetailDto materialDetail(UUID materialId, UUID selectedVersionId, CurrentUser viewer) {
        Material material = materialRepository.findById(materialId).orElseThrow();
        List<MaterialVersion> versions = materialVersionRepository.findByMaterialIdOrderByNumberAsc(materialId);
        return materialViewService.buildDetail(material, versions, selectedVersionId, viewer);
    }

    private static void ensureNotObsolete(Material material) {
        if (material.getObsoleteAt() != null) {
            throw new ApiException(ErrorCode.MATERIAL_OBSOLETE, HttpStatus.CONFLICT, "Material is obsolete");
        }
    }

    private static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, message);
    }

    private static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }
}
