package com.clearpath.review.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class SessionTokenService {

    private static final Base64.Encoder B64_URL = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64_URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final byte[] secretKey;

    public SessionTokenService(ObjectMapper objectMapper, SessionProperties properties) {
        this.objectMapper = objectMapper;
        this.secretKey = properties.secret().getBytes(StandardCharsets.UTF_8);
    }

    public String sign(UUID userId, Instant expiresAt) {
        SessionPayload payload = new SessionPayload(userId, expiresAt.getEpochSecond());
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            String payloadPart = B64_URL.encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
            String signaturePart = B64_URL.encodeToString(hmac(payloadPart));
            return payloadPart + "." + signaturePart;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize session payload", e);
        }
    }

    public SessionPayload verify(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        int dot = token.indexOf('.');
        if (dot <= 0 || dot == token.length() - 1) {
            return null;
        }
        String payloadPart = token.substring(0, dot);
        String signaturePart = token.substring(dot + 1);
        byte[] expectedSig;
        try {
            expectedSig = hmac(payloadPart);
        } catch (IllegalStateException e) {
            return null;
        }
        byte[] providedSig;
        try {
            providedSig = B64_URL_DECODER.decode(signaturePart);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!MessageDigest.isEqual(expectedSig, providedSig)) {
            return null;
        }
        try {
            byte[] payloadBytes = B64_URL_DECODER.decode(payloadPart);
            SessionPayload payload = objectMapper.readValue(payloadBytes, SessionPayload.class);
            if (payload.userId() == null || payload.exp() <= 0) {
                return null;
            }
            if (Instant.now().getEpochSecond() >= payload.exp()) {
                return null;
            }
            return payload;
        } catch (Exception e) {
            return null;
        }
    }

    private byte[] hmac(String payloadPart) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey, "HmacSHA256"));
            return mac.doFinal(payloadPart.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Failed to compute session HMAC", e);
        }
    }
}
