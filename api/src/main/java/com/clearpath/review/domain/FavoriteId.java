package com.clearpath.review.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class FavoriteId implements Serializable {

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "material_id")
    private UUID materialId;

    protected FavoriteId() {}

    public FavoriteId(UUID userId, UUID materialId) {
        this.userId = userId;
        this.materialId = materialId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getMaterialId() {
        return materialId;
    }

    public void setMaterialId(UUID materialId) {
        this.materialId = materialId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        FavoriteId that = (FavoriteId) o;
        return Objects.equals(userId, that.userId) && Objects.equals(materialId, that.materialId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, materialId);
    }
}
