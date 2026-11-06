package com.clearpath.review.web.social;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.service.social.NotificationService;
import com.clearpath.review.web.social.dto.NotificationDto;
import com.clearpath.review.web.social.dto.NotificationListDto;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public NotificationListDto listNotifications(CurrentUser user) {
        return notificationService.listNotifications(user);
    }

    @PostMapping("/{id}/read")
    public NotificationDto markRead(@PathVariable UUID id, CurrentUser user) {
        return notificationService.markRead(id, user);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(CurrentUser user) {
        notificationService.markAllRead(user);
    }
}
