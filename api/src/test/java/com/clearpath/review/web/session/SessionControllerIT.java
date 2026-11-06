package com.clearpath.review.web.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.clearpath.review.support.AbstractPostgresIT;
import com.clearpath.review.support.TestFixtures;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@AutoConfigureMockMvc
class SessionControllerIT extends AbstractPostgresIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String userEmail;

    @BeforeEach
    void seedUser() {
        userEmail = "alice-" + System.nanoTime() + "@example.com";
        TestFixtures.insertUser(jdbcTemplate, passwordEncoder, userEmail, "Alice", "demo-demo");
    }

    @Test
    void getSessionWithoutCookieReturnsNullUser() throws Exception {
        mockMvc.perform(get("/api/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user", nullValue()));
    }

    @Test
    void loginSuccessSetsCookieAndReturnsUser() throws Exception {
        mockMvc.perform(post("/api/session/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + userEmail + "\",\"password\":\"demo-demo\"}"))
                .andExpect(status().isOk())
                .andExpect(cookie().httpOnly("clearpath_session", true))
                .andExpect(cookie().path("clearpath_session", "/"))
                .andExpect(jsonPath("$.user.email").value(userEmail))
                .andExpect(jsonPath("$.user.name").value("Alice"));
    }

    @Test
    void loginFailureReturns401() throws Exception {
        mockMvc.perform(post("/api/session/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + userEmail + "\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    void switchUserRequiresSessionAndUpdatesCookie() throws Exception {
        String otherEmail = "bob-" + System.nanoTime() + "@example.com";
        TestFixtures.insertUser(jdbcTemplate, passwordEncoder, otherEmail, "Bob", "demo-demo");

        MvcResult login = mockMvc.perform(post("/api/session/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + userEmail + "\",\"password\":\"demo-demo\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie sessionCookie = login.getResponse().getCookie("clearpath_session");

        mockMvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());

        String bobId = jdbcTemplate.queryForObject(
                "SELECT id::text FROM app_user WHERE email = ?", String.class, otherEmail);

        mockMvc.perform(post("/api/session/switch")
                        .cookie(sessionCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + bobId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(otherEmail));
    }

    @Test
    void logoutClearsCookie() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/session/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + userEmail + "\",\"password\":\"demo-demo\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie sessionCookie = login.getResponse().getCookie("clearpath_session");

        mockMvc.perform(post("/api/session/logout").cookie(sessionCookie))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user", nullValue()));
    }

    @Test
    void setCookieIncludesSameSiteLax() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/session/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + userEmail + "\",\"password\":\"demo-demo\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = login.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).containsIgnoringCase("SameSite=Lax");
    }

    @Test
    void cookieOfDeletedUserIsUnauthorizedNotServerError() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/session/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + userEmail + "\",\"password\":\"demo-demo\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie sessionCookie = login.getResponse().getCookie("clearpath_session");
        jdbcTemplate.update("DELETE FROM app_user WHERE email = ?", userEmail);

        mockMvc.perform(get("/api/materials").cookie(sessionCookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
        mockMvc.perform(post("/api/session/logout").cookie(sessionCookie))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/session").cookie(sessionCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user", nullValue()));
    }
}
