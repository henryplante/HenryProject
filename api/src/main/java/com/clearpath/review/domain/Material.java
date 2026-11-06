package com.clearpath.review.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "material")
public class Material {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private AppUser owner;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MaterialChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MaterialAudience audience;

    @Column(name = "intended_use", nullable = false)
    private String intendedUse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_version_id")
    private MaterialVersion currentVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_version_id")
    private MaterialVersion approvedVersion;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "approved_until")
    private Instant approvedUntil;

    @Column(name = "obsolete_at")
    private Instant obsoleteAt;

    @Column(name = "expiry_notified_at")
    private Instant expiryNotifiedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Material() {}

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public AppUser getOwner() {
        return owner;
    }

    public void setOwner(AppUser owner) {
        this.owner = owner;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public MaterialChannel getChannel() {
        return channel;
    }

    public void setChannel(MaterialChannel channel) {
        this.channel = channel;
    }

    public MaterialAudience getAudience() {
        return audience;
    }

    public void setAudience(MaterialAudience audience) {
        this.audience = audience;
    }

    public String getIntendedUse() {
        return intendedUse;
    }

    public void setIntendedUse(String intendedUse) {
        this.intendedUse = intendedUse;
    }

    public MaterialVersion getCurrentVersion() {
        return currentVersion;
    }

    public void setCurrentVersion(MaterialVersion currentVersion) {
        this.currentVersion = currentVersion;
    }

    public MaterialVersion getApprovedVersion() {
        return approvedVersion;
    }

    public void setApprovedVersion(MaterialVersion approvedVersion) {
        this.approvedVersion = approvedVersion;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Instant approvedAt) {
        this.approvedAt = approvedAt;
    }

    public Instant getApprovedUntil() {
        return approvedUntil;
    }

    public void setApprovedUntil(Instant approvedUntil) {
        this.approvedUntil = approvedUntil;
    }

    public Instant getObsoleteAt() {
        return obsoleteAt;
    }

    public void setObsoleteAt(Instant obsoleteAt) {
        this.obsoleteAt = obsoleteAt;
    }

    public Instant getExpiryNotifiedAt() {
        return expiryNotifiedAt;
    }

    public void setExpiryNotifiedAt(Instant expiryNotifiedAt) {
        this.expiryNotifiedAt = expiryNotifiedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
