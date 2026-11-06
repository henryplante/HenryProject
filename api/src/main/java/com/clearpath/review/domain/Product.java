package com.clearpath.review.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "product")
public class Product {

    @Id
    private java.util.UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "approval_lifetime_days", nullable = false)
    private int approvalLifetimeDays;

    protected Product() {}

    public java.util.UUID getId() {
        return id;
    }

    public void setId(java.util.UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getApprovalLifetimeDays() {
        return approvalLifetimeDays;
    }

    public void setApprovalLifetimeDays(int approvalLifetimeDays) {
        this.approvalLifetimeDays = approvalLifetimeDays;
    }
}
