package com.clearpath.review.auth;

import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import com.clearpath.review.web.error.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

public class SessionFilter extends OncePerRequestFilter {

    public static final String CURRENT_USER_ATTRIBUTE = "clearpath.currentUser";

    private final SessionTokenService sessionTokenService;
    private final CurrentUserLoader currentUserLoader;
    private final SessionProperties sessionProperties;
    private final ObjectMapper objectMapper;

    public SessionFilter(
            SessionTokenService sessionTokenService,
            CurrentUserLoader currentUserLoader,
            SessionProperties sessionProperties,
            ObjectMapper objectMapper) {
        this.sessionTokenService = sessionTokenService;
        this.currentUserLoader = currentUserLoader;
        this.sessionProperties = sessionProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!request.getRequestURI().startsWith("/api/")) {
            return true;
        }
        String path = request.getRequestURI();
        if ("/api/health".equals(path) || "/api/session/login".equals(path)) {
            return true;
        }
        return "/api/session".equals(path) && "GET".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = readSessionCookie(request);
        SessionPayload payload = sessionTokenService.verify(token);
        if (payload == null) {
            writeUnauthorized(response);
            return;
        }
        CurrentUser user;
        try {
            user = currentUserLoader.load(payload.userId());
        } catch (ApiException ex) {
            writeUnauthorized(response);
            return;
        }
        request.setAttribute(CURRENT_USER_ATTRIBUTE, user);
        filterChain.doFilter(request, response);
    }

    private String readSessionCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        String cookieName = sessionProperties.cookieName();
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ErrorResponse body = new ErrorResponse(
                new ErrorResponse.ErrorBody(ErrorCode.UNAUTHORIZED.name(), "Authentication required", null));
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
