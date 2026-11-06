package com.clearpath.review.service.setup;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public final class SetupDtos {

    private SetupDtos() {}

    public record UserDto(UUID id, String name, String email, List<UUID> groupIds) {}

    public record UserInputDto(
            @NotBlank String name,
            @NotBlank @Email String email,
            String password,
            @NotNull List<UUID> groupIds) {}

    public record GroupDto(UUID id, String name, List<UUID> memberIds) {}

    public record GroupInputDto(@NotBlank String name) {}

    public record GroupMembersInputDto(@NotNull List<UUID> userIds) {}

    public record StepRequirementDto(UUID id, UUID groupId, String groupName, int approvalsRequired) {}

    public record WorkflowStepDto(UUID id, int position, String name, List<StepRequirementDto> requirements) {}

    public record ProductDto(UUID id, String name, int approvalLifetimeDays, List<WorkflowStepDto> steps) {}

    public record ProductInputDto(
            @NotBlank String name,
            @Min(1) int approvalLifetimeDays,
            @NotNull @Valid List<WorkflowStepInputDto> steps) {}

    public record WorkflowStepInputDto(
            @Min(1) int position,
            @NotBlank String name,
            @NotNull @Valid List<StepRequirementInputDto> requirements) {}

    public record StepRequirementInputDto(
            @NotNull UUID groupId,
            @Min(1) int approvalsRequired) {}
}
