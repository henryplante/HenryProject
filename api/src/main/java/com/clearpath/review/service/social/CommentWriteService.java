package com.clearpath.review.service.social;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.Comment;
import com.clearpath.review.domain.CommentRepository;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialVersion;
import com.clearpath.review.domain.MaterialVersionRepository;
import com.clearpath.review.domain.Notification;
import com.clearpath.review.domain.NotificationRepository;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import com.clearpath.review.web.materials.dto.CommentDto;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentWriteService {

    private final MaterialVersionRepository materialVersionRepository;
    private final AppUserRepository appUserRepository;
    private final CommentRepository commentRepository;
    private final NotificationRepository notificationRepository;

    public CommentWriteService(
            MaterialVersionRepository materialVersionRepository,
            AppUserRepository appUserRepository,
            CommentRepository commentRepository,
            NotificationRepository notificationRepository) {
        this.materialVersionRepository = materialVersionRepository;
        this.appUserRepository = appUserRepository;
        this.commentRepository = commentRepository;
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public CommentDto createComment(UUID versionId, String body, CurrentUser author) {
        MaterialVersion version = materialVersionRepository
                .findById(versionId)
                .orElseThrow(() -> notFound("Version not found"));
        Material material = version.getMaterial();
        if (material.getObsoleteAt() != null) {
            throw new ApiException(ErrorCode.MATERIAL_OBSOLETE, HttpStatus.CONFLICT, "Material is obsolete");
        }

        AppUser authorEntity =
                appUserRepository.findById(author.id()).orElseThrow(() -> notFound("User not found"));
        Instant now = Instant.now();

        Comment comment = EntityFactory.create(Comment.class);
        comment.setId(UUID.randomUUID());
        comment.setVersion(version);
        comment.setAuthor(authorEntity);
        comment.setBody(body.trim());
        comment.setCreatedAt(now);
        commentRepository.save(comment);

        UUID ownerId = material.getOwner().getId();
        if (!ownerId.equals(author.id())) {
            Notification notification = EntityFactory.create(Notification.class);
            notification.setId(UUID.randomUUID());
            notification.setUser(material.getOwner());
            notification.setMaterial(material);
            notification.setActor(authorEntity);
            notification.setKind("comment_added");
            notification.setDetail(Map.of("version", version.getNumber(), "actorName", authorEntity.getName()));
            notification.setCreatedAt(now);
            notificationRepository.save(notification);
        }

        return new CommentDto(
                comment.getId(),
                versionId,
                authorEntity.getId(),
                authorEntity.getName(),
                comment.getBody(),
                comment.getCreatedAt());
    }

    private static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }
}
