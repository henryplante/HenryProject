package com.clearpath.review.web.tasks;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.service.tasks.TaskCounts;
import com.clearpath.review.service.tasks.TaskQueryService;
import com.clearpath.review.service.tasks.TaskRow;
import com.clearpath.review.service.tasks.TaskTab;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskQueryService taskQueryService;

    public TaskController(TaskQueryService taskQueryService) {
        this.taskQueryService = taskQueryService;
    }

    @GetMapping
    public List<TaskRow> listTasks(@RequestParam(name = "tab") String tabParam, CurrentUser currentUser) {
        TaskTab tab = parseTab(tabParam);
        return taskQueryService.listTasks(currentUser.id(), tab);
    }

    @GetMapping("/counts")
    public TaskCounts getTaskCounts(CurrentUser currentUser) {
        return taskQueryService.counts(currentUser.id());
    }

    private static TaskTab parseTab(String tabParam) {
        if (tabParam == null || tabParam.isBlank()) {
            throw validation("Query parameter 'tab' is required");
        }
        try {
            return TaskTab.valueOf(tabParam.trim().toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            String allowed = Arrays.stream(TaskTab.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            throw validation("Invalid tab; allowed values: " + allowed);
        }
    }

    private static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, message);
    }
}
