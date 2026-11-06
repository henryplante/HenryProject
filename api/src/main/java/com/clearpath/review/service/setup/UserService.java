package com.clearpath.review.service.setup;

import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.service.setup.SetupDtos.UserDto;
import com.clearpath.review.service.setup.SetupDtos.UserInputDto;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final AppUserRepository appUserRepository;
    private final MembershipSync membershipSync;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            AppUserRepository appUserRepository, MembershipSync membershipSync, PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.membershipSync = membershipSync;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserDto> listUsers() {
        return appUserRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public UserDto createUser(UserInputDto input) {
        if (input.password() == null || input.password().isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "password is required when creating a user");
        }
        ensureEmailAvailable(input.email(), null);
        AppUser user = EntityFactory.create(AppUser.class);
        user.setId(UUID.randomUUID());
        user.setName(input.name());
        user.setEmail(input.email());
        user.setPasswordHash(passwordEncoder.encode(input.password()));
        user.setCreatedAt(Instant.now());
        appUserRepository.save(user);
        membershipSync.replaceUserGroups(user.getId(), input.groupIds());
        return toDto(user);
    }

    @Transactional
    public UserDto updateUser(UUID id, UserInputDto input) {
        AppUser user = appUserRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Not found"));
        ensureEmailAvailable(input.email(), id);
        user.setName(input.name());
        user.setEmail(input.email());
        if (input.password() != null && !input.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(input.password()));
        }
        membershipSync.replaceUserGroups(id, input.groupIds());
        return toDto(user);
    }

    private UserDto toDto(AppUser user) {
        return new UserDto(
                user.getId(),
                user.getName(),
                user.getEmail(),
                membershipSync.groupIdsForUser(user.getId()));
    }

    private void ensureEmailAvailable(String email, UUID exceptUserId) {
        boolean taken = appUserRepository.findAllByEmailIgnoreCase(email).stream()
                .anyMatch(existing -> exceptUserId == null || !existing.getId().equals(exceptUserId));
        if (taken) {
            throw new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Email already in use");
        }
    }
}
