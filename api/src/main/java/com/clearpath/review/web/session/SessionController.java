package com.clearpath.review.web.session;

import com.clearpath.review.auth.CurrentUser;
import com.clearpath.review.service.session.SessionDtos.LoginRequestDto;
import com.clearpath.review.service.session.SessionDtos.SessionResponseDto;
import com.clearpath.review.service.session.SessionDtos.SwitchUserRequestDto;
import com.clearpath.review.service.session.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/session")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping
    public SessionResponseDto getSession(HttpServletRequest request) {
        return sessionService.getSession(request);
    }

    @PostMapping("/login")
    public SessionResponseDto login(
            @Valid @RequestBody LoginRequestDto body, HttpServletResponse response) {
        return sessionService.login(body, response);
    }

    @PostMapping("/switch")
    public SessionResponseDto switchUser(
            @Valid @RequestBody SwitchUserRequestDto body, CurrentUser ignored, HttpServletResponse response) {
        return sessionService.switchUser(body, response);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletResponse response) {
        sessionService.logout(response);
    }
}
