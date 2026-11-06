package com.clearpath.review.service.social;

import com.clearpath.review.domain.Activity;
import com.clearpath.review.domain.ActivityRepository;
import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.Material;
import com.clearpath.review.domain.MaterialRepository;
import com.clearpath.review.domain.Notification;
import com.clearpath.review.domain.NotificationRepository;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LazyExpiryService {

    private static final String EXPIRE_AND_CLAIM = """
            UPDATE material
            SET expiry_notified_at = now()
            WHERE approved_version_id IS NOT NULL
              AND approved_until <= now()
              AND expiry_notified_at IS NULL
              AND obsolete_at IS NULL
            RETURNING id, owner_id
            """;

    private final JdbcTemplate jdbcTemplate;
    private final MaterialRepository materialRepository;
    private final AppUserRepository appUserRepository;
    private final NotificationRepository notificationRepository;
    private final ActivityRepository activityRepository;

    public LazyExpiryService(
            JdbcTemplate jdbcTemplate,
            MaterialRepository materialRepository,
            AppUserRepository appUserRepository,
            NotificationRepository notificationRepository,
            ActivityRepository activityRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.materialRepository = materialRepository;
        this.appUserRepository = appUserRepository;
        this.notificationRepository = notificationRepository;
        this.activityRepository = activityRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void run() {
        List<ExpiredMaterial> expired =
                jdbcTemplate.query(EXPIRE_AND_CLAIM, (rs, rowNum) -> new ExpiredMaterial(
                        UUID.fromString(rs.getString("id")), UUID.fromString(rs.getString("owner_id"))));
        if (expired.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        for (ExpiredMaterial row : expired) {
            Material material = materialRepository.getReferenceById(row.materialId());
            AppUser owner = appUserRepository.getReferenceById(row.ownerId());

            Notification notification = EntityFactory.create(Notification.class);
            notification.setId(UUID.randomUUID());
            notification.setUser(owner);
            notification.setMaterial(material);
            notification.setActor(null);
            notification.setKind("material_expired");
            notification.setDetail(Collections.emptyMap());
            notification.setCreatedAt(now);
            notificationRepository.save(notification);

            Activity activity = EntityFactory.create(Activity.class);
            activity.setId(UUID.randomUUID());
            activity.setMaterial(material);
            activity.setActor(owner);
            activity.setType("expired");
            activity.setDetail(Map.of());
            activity.setCreatedAt(now);
            activityRepository.save(activity);
        }
    }

    private record ExpiredMaterial(UUID materialId, UUID ownerId) {}
}
