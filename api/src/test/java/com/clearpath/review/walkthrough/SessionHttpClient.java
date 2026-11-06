package com.clearpath.review.walkthrough;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * HTTP session helper: real login and user switch with cookie jar semantics.
 */
public final class SessionHttpClient {

    private final TestRestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String cookieName;
    private String cookieHeader;

    public SessionHttpClient(TestRestTemplate restTemplate, ObjectMapper objectMapper, String cookieName) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.cookieName = cookieName;
    }

    public JsonNode login(String email, String password) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
        ResponseEntity<String> response =
                restTemplate.exchange("/api/session/login", HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
        captureSession(response);
        return objectMapper.readTree(response.getBody());
    }

    public JsonNode switchUser(String userId) throws Exception {
        HttpHeaders headers = headers();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"userId\":\"" + userId + "\"}";
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/session/switch", HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
        captureSession(response);
        return objectMapper.readTree(response.getBody());
    }

    public HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        if (cookieHeader != null) {
            headers.add(HttpHeaders.COOKIE, cookieHeader);
        }
        return headers;
    }

    public ResponseEntity<String> get(String path) {
        return restTemplate.exchange(path, HttpMethod.GET, new HttpEntity<>(headers()), String.class);
    }

    public ResponseEntity<String> exchange(HttpMethod method, String path, HttpEntity<?> entity) {
        HttpHeaders merged = new HttpHeaders();
        merged.addAll(headers());
        if (entity.getHeaders() != null) {
            merged.addAll(entity.getHeaders());
        }
        return restTemplate.exchange(path, method, new HttpEntity<>(entity.getBody(), merged), String.class);
    }

    public void clearSession() {
        cookieHeader = null;
    }

    private void captureSession(ResponseEntity<?> response) {
        List<String> setCookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        if (setCookies == null) {
            return;
        }
        String prefix = cookieName + "=";
        for (String setCookie : setCookies) {
            if (setCookie.startsWith(prefix)) {
                int semi = setCookie.indexOf(';');
                cookieHeader = semi > 0 ? setCookie.substring(0, semi) : setCookie;
                return;
            }
        }
    }
}
