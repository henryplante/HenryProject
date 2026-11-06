package com.clearpath.review.review.events;

import com.clearpath.review.domain.Activity;
import com.clearpath.review.review.DomainEntityFactory;
import com.clearpath.review.domain.ActivityRepository;
import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.Notification;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.NotificationRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ReviewEventWriter {

    private final ActivityRepository activityRepository;
    private final NotificationRepository notificationRepository;
    private final AppUserRepository appUserRepository;

    public ReviewEventWriter(
            ActivityRepository activityRepository,
            NotificationRepository notificationRepository,
            AppUserRepository appUserRepository) {
        this.activityRepository = activityRepository;
        this.notificationRepository = notificationRepository;
        this.appUserRepository = appUserRepository;
    }

    public void reviewStarted(Material material, AppUser actor, int versionNumber, Instant at) {
        writeActivity(material, actor, "review_started", at, Map.of("version", versionNumber));
    }

    public void stepOpened(
            Material material,
            AppUser actor,
            int stepPosition,
            String stepName,
            Set<UUID> recipientUserIds,
            Instant at) {
        Map<String, Object> detail = Map.of("step", stepPosition, "stepName", stepName);
        for (UUID userId : recipientUserIds) {
            writeNotification(userId, material, actor, "step_opened", detail, at);
        }
    }

    public void approved(
            Material material, AppUser approver, AppUser owner, String groupName, int position, Instant at) {
        Map<String, Object> detail = Map.of("groupName", groupName, "position", position, "step", position);
        writeActivity(material, approver, "approved", at, detail);
        if (!approver.getId().equals(owner.getId())) {
            writeNotification(owner.getId(), material, approver, "approved", detail, at);
        }
    }

    public void stepCompleted(
            Material material, AppUser actor, AppUser owner, int stepPosition, String stepName, Instant at) {
        Map<String, Object> detail = Map.of("step", stepPosition, "stepName", stepName);
        writeActivity(material, actor, "step_completed", at, detail);
        writeNotification(owner.getId(), material, actor, "step_completed", detail, at);
    }

    public void fullyApproved(
            Material material, AppUser actor, AppUser owner, int versionNumber, Instant approvedUntil, Instant at) {
        Map<String, Object> detail = Map.of("version", versionNumber, "approvedUntil", approvedUntil.toString());
        writeActivity(material, actor, "fully_approved", at, detail);
        writeNotification(owner.getId(), material, actor, "fully_approved", detail, at);
    }

    public void reviewRestarted(Material material, AppUser actor, int versionNumber, Instant at) {
        writeActivity(material, actor, "review_restarted", at, Map.of("version", versionNumber));
    }

    public void uploaded(Material material, AppUser actor, int versionNumber, String note, Instant at) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("version", versionNumber);
        if (note != null && !note.isBlank()) {
            detail.put("note", note.trim());
        }
        writeActivity(material, actor, "uploaded", at, detail);
    }

    public void productChanged(Material material, AppUser actor, String fromName, String toName, Instant at) {
        writeActivity(material, actor, "product_changed", at, Map.of(
                        "from", fromName, "to", toName, "fromProductName", fromName, "toProductName", toName));
    }

    public void ownerChanged(Material material, AppUser actor, String fromName, String toName, Instant at) {
        writeActivity(
                material, actor, "owner_changed", at, Map.of("from", fromName, "to", toName, "ownerName", toName));
    }

    public void obsolete(Material material, AppUser actor, AppUser owner, Instant at) {
        writeActivity(material, actor, "obsolete", at, Map.of());
        if (!actor.getId().equals(owner.getId())) {
            writeNotification(owner.getId(), material, actor, "obsolete", Map.of(), at);
        }
    }

    private void writeActivity(Material material, AppUser actor, String type, Instant at, Map<String, Object> detail) {
        Activity activity = DomainEntityFactory.create(Activity.class);
        activity.setId(UUID.randomUUID());
        activity.setMaterial(material);
        activity.setActor(actor);
        activity.setType(type);
        activity.setDetail(detail);
        activity.setCreatedAt(at);
        activityRepository.save(activity);
    }

    private void writeNotification(
            UUID userId,
            Material material,
            AppUser actor,
            String kind,
            Map<String, Object> detail,
            Instant at) {
        Notification notification = DomainEntityFactory.create(Notification.class);
        notification.setId(UUID.randomUUID());
        notification.setUser(appUserRepository.getReferenceById(userId));
        notification.setMaterial(material);
        notification.setActor(actor);
        notification.setKind(kind);
        Map<String, Object> enriched = new LinkedHashMap<>(detail);
        if (actor != null && actor.getName() != null) {
            enriched.putIfAbsent("actorName", actor.getName());
        }
        notification.setDetail(enriched);
        notification.setCreatedAt(at);
        notificationRepository.save(notification);
    }
}
