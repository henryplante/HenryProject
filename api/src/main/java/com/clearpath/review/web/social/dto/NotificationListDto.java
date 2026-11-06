package com.clearpath.review.web.social.dto;

import java.util.List;

public record NotificationListDto(List<NotificationDto> items, long unreadCount) {}
