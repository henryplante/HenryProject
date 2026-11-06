package com.clearpath.review.service.setup;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;

final class EntityFactory {

    private EntityFactory() {}

    static <T> T create(Class<T> type) {
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
