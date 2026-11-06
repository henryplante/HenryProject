package com.clearpath.review.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserGroupRepository extends JpaRepository<UserGroup, UUID> {

    Optional<UserGroup> findByName(String name);

    List<UserGroup> findAllByNameIgnoreCase(String name);
}
