package com.clearpath.review.web.error;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final HttpStatus httpStatus;
    private final Object details;

    public ApiException(ErrorCode code, HttpStatus httpStatus, String message) {
        this(code, httpStatus, message, null);
    }

    public ApiException(ErrorCode code, HttpStatus httpStatus, String message, Object details) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.details = details;
    }

    public ErrorCode getCode() {
        return code;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public Object getDetails() {
        return details;
    }
}
