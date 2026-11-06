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
@Table(name = "step_requirement")
public class StepRequirement {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "step_id", nullable = false)
    private WorkflowStep step;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    private UserGroup group;

    @Column(name = "approvals_required", nullable = false)
    private int approvalsRequired;

    protected StepRequirement() {}

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public WorkflowStep getStep() {
        return step;
    }

    public void setStep(WorkflowStep step) {
        this.step = step;
    }

    public UserGroup getGroup() {
        return group;
    }

    public void setGroup(UserGroup group) {
        this.group = group;
    }

    public int getApprovalsRequired() {
        return approvalsRequired;
    }

    public void setApprovalsRequired(int approvalsRequired) {
        this.approvalsRequired = approvalsRequired;
    }
}
