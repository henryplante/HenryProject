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
@Table(name = "review_cycle")
public class ReviewCycle {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "version_id", nullable = false)
    private MaterialVersion version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReviewCycleStatus status;

    @Column(name = "current_position", nullable = false)
    private int currentPosition;

    @Column(name = "approval_lifetime_days", nullable = false)
    private int approvalLifetimeDays;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "started_by", nullable = false)
    private AppUser startedBy;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    protected ReviewCycle() {}

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Material getMaterial() {
        return material;
    }

    public void setMaterial(Material material) {
        this.material = material;
    }

    public MaterialVersion getVersion() {
        return version;
    }

    public void setVersion(MaterialVersion version) {
        this.version = version;
    }

    public ReviewCycleStatus getStatus() {
        return status;
    }

    public void setStatus(ReviewCycleStatus status) {
        this.status = status;
    }

    public int getCurrentPosition() {
        return currentPosition;
    }

    public void setCurrentPosition(int currentPosition) {
        this.currentPosition = currentPosition;
    }

    public int getApprovalLifetimeDays() {
        return approvalLifetimeDays;
    }

    public void setApprovalLifetimeDays(int approvalLifetimeDays) {
        this.approvalLifetimeDays = approvalLifetimeDays;
    }

    public AppUser getStartedBy() {
        return startedBy;
    }

    public void setStartedBy(AppUser startedBy) {
        this.startedBy = startedBy;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }
}
