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

    public void stepOpened(Material material, AppUser actor, int stepPosition, Set<UUID> recipientUserIds, Instant at) {
        Map<String, Object> detail = Map.of("step", stepPosition);
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

    public void stepCompleted(Material material, AppUser actor, AppUser owner, int stepPosition, Instant at) {
        Map<String, Object> detail = Map.of("step", stepPosition);
        writeActivity(material, actor, "step_completed", at, detail);
        writeNotification(owner.getId(), material, actor, "step_completed", detail, at);
    }

    public void fullyApproved(Material material, AppUser actor, AppUser owner, Instant at) {
        writeActivity(material, actor, "fully_approved", at, Map.of());
        writeNotification(owner.getId(), material, actor, "fully_approved", Map.of(), at);
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
        notification.setDetail(detail);
        notification.setCreatedAt(at);
        notificationRepository.save(notification);
    }
}
