package com.clearpath.review.web.error;

public record ErrorResponse(ErrorBody error) {

    public record ErrorBody(String code, String message, Object details) {}
}
