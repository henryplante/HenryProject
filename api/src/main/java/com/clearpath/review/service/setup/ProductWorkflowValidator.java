package com.clearpath.review.service.setup;

import com.clearpath.review.service.setup.SetupDtos.ProductInputDto;
import com.clearpath.review.service.setup.SetupDtos.StepRequirementInputDto;
import com.clearpath.review.service.setup.SetupDtos.WorkflowStepInputDto;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;

final class ProductWorkflowValidator {

    private ProductWorkflowValidator() {}

    static void validate(ProductInputDto input) {
        List<WorkflowStepInputDto> steps = input.steps();
        if (steps == null || steps.isEmpty()) {
            throw validation("Product must have at least one workflow step");
        }
        if (input.approvalLifetimeDays() <= 0) {
            throw validation("approvalLifetimeDays must be greater than 0");
        }
        int expectedPosition = 1;
        for (WorkflowStepInputDto step : steps.stream()
                .sorted((a, b) -> Integer.compare(a.position(), b.position()))
                .toList()) {
            if (step.position() != expectedPosition) {
                throw validation("Step positions must be contiguous starting at 1");
            }
            expectedPosition++;
            List<StepRequirementInputDto> requirements = step.requirements();
            if (requirements == null || requirements.isEmpty()) {
                throw validation("Each workflow step must have at least one requirement");
            }
            Set<java.util.UUID> groupsInStep = new HashSet<>();
            for (StepRequirementInputDto req : requirements) {
                if (req.approvalsRequired() < 1) {
                    throw validation("approvalsRequired must be at least 1");
                }
                if (!groupsInStep.add(req.groupId())) {
                    throw validation("Each group may appear only once per workflow step");
                }
            }
        }
    }

    private static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, message);
    }
}
