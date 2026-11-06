package com.clearpath.review.service.social;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.domain.Notification;
import com.clearpath.review.domain.NotificationRepository;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import com.clearpath.review.web.social.dto.NotificationDto;
import com.clearpath.review.web.social.dto.NotificationListDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private static final int DEFAULT_LIMIT = 50;

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public NotificationListDto listNotifications(CurrentUser user) {
        UUID userId = user.id();
        List<NotificationDto> items = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, DEFAULT_LIMIT))
                .stream()
                .map(this::toDto)
                .toList();
        long unreadCount = notificationRepository.countByUserIdAndReadAtIsNull(userId);
        return new NotificationListDto(items, unreadCount);
    }

    @Transactional
    public NotificationDto markRead(UUID notificationId, CurrentUser user) {
        Notification notification = notificationRepository
                .findByIdAndUserId(notificationId, user.id())
                .orElseThrow(() -> notFound("Notification not found"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(Instant.now());
        }
        return toDto(notification);
    }

    @Transactional
    public void markAllRead(CurrentUser user) {
        notificationRepository.markAllReadForUser(user.id(), Instant.now());
    }

    private NotificationDto toDto(Notification notification) {
        return new NotificationDto(
                notification.getId(),
                notification.getKind(),
                notification.getMaterial().getId(),
                notification.getMaterial().getTitle(),
                notification.getReadAt() != null,
                notification.getCreatedAt(),
                notification.getDetail());
    }

    private static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }
}
