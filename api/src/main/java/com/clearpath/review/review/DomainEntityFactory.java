package com.clearpath.review.review;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;

public final class DomainEntityFactory {

    private DomainEntityFactory() {}

    public static <T> T create(Class<T> type) {
        try {
            Constructor<T> constructor = type.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (NoSuchMethodException
                | InstantiationException
                | IllegalAccessException
                | InvocationTargetException e) {
            throw new IllegalStateException("Failed to instantiate " + type.getSimpleName(), e);
        }
    }
}
