package com.clearpath.review.service.session;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.auth.CurrentUserLoader;
import com.clearpath.review.auth.SessionCookies;
import com.clearpath.review.auth.SessionPayload;
import com.clearpath.review.auth.SessionTokenService;
import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.service.session.SessionDtos.LoginRequestDto;
import com.clearpath.review.service.session.SessionDtos.SessionResponseDto;
import com.clearpath.review.service.session.SessionDtos.SessionUserDto;
import com.clearpath.review.service.session.SessionDtos.SwitchUserRequestDto;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class SessionService {

    private final AppUserRepository appUserRepository;
    private final SessionTokenService sessionTokenService;
    private final SessionCookies sessionCookies;
    private final CurrentUserLoader currentUserLoader;
    private final PasswordEncoder passwordEncoder;

    public SessionService(
            AppUserRepository appUserRepository,
            SessionTokenService sessionTokenService,
            SessionCookies sessionCookies,
            CurrentUserLoader currentUserLoader,
            PasswordEncoder passwordEncoder) {
        this.appUserRepository = appUserRepository;
        this.sessionTokenService = sessionTokenService;
        this.sessionCookies = sessionCookies;
        this.currentUserLoader = currentUserLoader;
        this.passwordEncoder = passwordEncoder;
    }

    public SessionResponseDto getSession(HttpServletRequest request) {
        String token = sessionCookies.readToken(request);
        SessionPayload payload = sessionTokenService.verify(token);
        if (payload == null) {
            return new SessionResponseDto(null);
        }
        try {
            CurrentUser user = currentUserLoader.load(payload.userId());
            return new SessionResponseDto(toSessionUser(user));
        } catch (ApiException ex) {
            if (ex.getCode() == ErrorCode.UNAUTHORIZED) {
                return new SessionResponseDto(null);
            }
            throw ex;
        }
    }

    public SessionResponseDto login(LoginRequestDto body, HttpServletResponse response) {
        AppUser user = appUserRepository
                .findByEmail(body.email())
                .orElseThrow(() -> invalidCredentials());
        if (!passwordEncoder.matches(body.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }
        issueSession(user.getId(), response);
        CurrentUser current = currentUserLoader.load(user.getId());
        return new SessionResponseDto(toSessionUser(current));
    }

    public SessionResponseDto switchUser(SwitchUserRequestDto body, HttpServletResponse response) {
        if (!appUserRepository.existsById(body.userId())) {
            throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Not found");
        }
        issueSession(body.userId(), response);
        CurrentUser current = currentUserLoader.load(body.userId());
        return new SessionResponseDto(toSessionUser(current));
    }

    public void logout(HttpServletResponse response) {
        sessionCookies.clearSession(response);
    }

    private void issueSession(UUID userId, HttpServletResponse response) {
        Instant expiresAt = Instant.now().plus(SessionCookies.SESSION_TTL);
        String token = sessionTokenService.sign(userId, expiresAt);
        sessionCookies.writeSession(response, token);
    }

    private static SessionUserDto toSessionUser(CurrentUser user) {
        return new SessionUserDto(user.id(), user.name(), user.email(), user.groupIds());
    }

    private static ApiException invalidCredentials() {
        return new ApiException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
}
