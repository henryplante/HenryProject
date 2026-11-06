package com.clearpath.review.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class SessionCookies {

    public static final Duration SESSION_TTL = Duration.ofDays(7);

    private final SessionProperties sessionProperties;

    public SessionCookies(SessionProperties sessionProperties) {
        this.sessionProperties = sessionProperties;
    }

    public String readToken(HttpServletRequest request) {
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

    public void writeSession(HttpServletResponse response, String token) {
        response.addHeader("Set-Cookie", buildCookie(token, SESSION_TTL).toString());
    }

    public void clearSession(HttpServletResponse response) {
        response.addHeader("Set-Cookie", buildCookie("", Duration.ZERO).toString());
    }

    private ResponseCookie buildCookie(String value, Duration maxAge) {
        return ResponseCookie.from(sessionProperties.cookieName(), value)
                .httpOnly(true)
                .path("/")
                .maxAge(maxAge)
                .sameSite("Lax")
                .build();
    }
}
