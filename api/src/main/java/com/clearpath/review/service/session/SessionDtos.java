package com.clearpath.review.service.session;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public final class SessionDtos {

    private SessionDtos() {}

    public record SessionUserDto(UUID id, String name, String email, List<UUID> groupIds) {}

    public record SessionResponseDto(@JsonInclude(JsonInclude.Include.ALWAYS) SessionUserDto user) {}

    public record LoginRequestDto(
            @NotBlank @Email String email,
            @NotBlank String password) {}

    public record SwitchUserRequestDto(@NotNull UUID userId) {}
}
