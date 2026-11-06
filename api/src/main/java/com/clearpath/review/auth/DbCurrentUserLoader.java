package com.clearpath.review.auth;

import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.Membership;
import com.clearpath.review.domain.MembershipRepository;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class DbCurrentUserLoader implements CurrentUserLoader {

    private final AppUserRepository appUserRepository;
    private final MembershipRepository membershipRepository;

    public DbCurrentUserLoader(AppUserRepository appUserRepository, MembershipRepository membershipRepository) {
        this.appUserRepository = appUserRepository;
        this.membershipRepository = membershipRepository;
    }

    @Override
    public CurrentUser load(UUID userId) {
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, "Authentication required"));
        List<UUID> groupIds = membershipRepository.findByIdUserId(userId).stream()
                .map(m -> m.getId().getGroupId())
                .toList();
        return new CurrentUser(user.getId(), user.getName(), user.getEmail(), groupIds);
    }
}
