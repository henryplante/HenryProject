package com.clearpath.review.service.tasks;

import java.util.UUID;

public record TaskRow(
        UUID materialId,
        String title,
        String productName,
        int versionNumber,
        String stepName,
        int daysWaiting,
        boolean overdue,
        TaskTab tab) {}
