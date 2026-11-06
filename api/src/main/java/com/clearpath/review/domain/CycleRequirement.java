package com.clearpath.review.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "cycle_requirement")
public class CycleRequirement {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_step_id", nullable = false)
    private CycleStep cycleStep;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private UserGroup group;

    @Column(name = "group_name", nullable = false)
    private String groupName;

    @Column(name = "approvals_required", nullable = false)
    private int approvalsRequired;

    protected CycleRequirement() {}

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public CycleStep getCycleStep() {
        return cycleStep;
    }

    public void setCycleStep(CycleStep cycleStep) {
        this.cycleStep = cycleStep;
    }

    public UserGroup getGroup() {
        return group;
    }

    public void setGroup(UserGroup group) {
        this.group = group;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public int getApprovalsRequired() {
        return approvalsRequired;
    }

    public void setApprovalsRequired(int approvalsRequired) {
        this.approvalsRequired = approvalsRequired;
    }
}
