package com.clearpath.review.config;

import com.clearpath.review.auth.CurrentUserArgumentResolver;
import com.clearpath.review.auth.CurrentUserLoader;
import com.clearpath.review.auth.CurrentUserLoader;
import com.clearpath.review.auth.SessionFilter;
import com.clearpath.review.auth.SessionProperties;
import com.clearpath.review.auth.SessionTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(SessionProperties.class)
public class WebConfig implements WebMvcConfigurer {

    private final CurrentUserArgumentResolver currentUserArgumentResolver;

    public WebConfig(CurrentUserArgumentResolver currentUserArgumentResolver) {
        this.currentUserArgumentResolver = currentUserArgumentResolver;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserArgumentResolver);
    }

    @Bean
    FilterRegistrationBean<SessionFilter> sessionFilterRegistration(
            SessionTokenService sessionTokenService,
            CurrentUserLoader currentUserLoader,
            SessionProperties sessionProperties,
            ObjectMapper objectMapper) {
        FilterRegistrationBean<SessionFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(
                new SessionFilter(sessionTokenService, currentUserLoader, sessionProperties, objectMapper));
        registration.addUrlPatterns("/*");
        registration.setOrder(1);
        return registration;
    }
}
