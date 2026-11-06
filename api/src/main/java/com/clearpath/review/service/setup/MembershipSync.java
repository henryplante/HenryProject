package com.clearpath.review.service.setup;

import com.clearpath.review.domain.AppUser;
import com.clearpath.review.domain.AppUserRepository;
import com.clearpath.review.domain.Membership;
import com.clearpath.review.domain.MembershipRepository;
import com.clearpath.review.domain.UserGroup;
import com.clearpath.review.domain.UserGroupRepository;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
class MembershipSync {

    private final AppUserRepository appUserRepository;
    private final UserGroupRepository userGroupRepository;
    private final MembershipRepository membershipRepository;

    MembershipSync(
            AppUserRepository appUserRepository,
            UserGroupRepository userGroupRepository,
            MembershipRepository membershipRepository) {
        this.appUserRepository = appUserRepository;
        this.userGroupRepository = userGroupRepository;
        this.membershipRepository = membershipRepository;
    }

    void replaceUserGroups(UUID userId, List<UUID> groupIds) {
        validateGroupsExist(groupIds);
        membershipRepository.deleteAll(membershipRepository.findByIdUserId(userId));
        AppUser user = appUserRepository.getReferenceById(userId);
        for (UUID groupId : distinct(groupIds)) {
            Membership membership = EntityFactory.create(Membership.class);
            membership.setUser(user);
            membership.setGroup(userGroupRepository.getReferenceById(groupId));
            membershipRepository.save(membership);
        }
    }

    void replaceGroupMembers(UUID groupId, List<UUID> userIds) {
        validateUsersExist(userIds);
        membershipRepository.deleteAll(membershipRepository.findByIdGroupId(groupId));
        UserGroup group = userGroupRepository.getReferenceById(groupId);
        for (UUID userId : distinct(userIds)) {
            Membership membership = EntityFactory.create(Membership.class);
            membership.setUser(appUserRepository.getReferenceById(userId));
            membership.setGroup(group);
            membershipRepository.save(membership);
        }
    }

    List<UUID> groupIdsForUser(UUID userId) {
        return membershipRepository.findByIdUserId(userId).stream()
                .map(m -> m.getId().getGroupId())
                .toList();
    }

    List<UUID> memberIdsForGroup(UUID groupId) {
        return membershipRepository.findByIdGroupId(groupId).stream()
                .map(m -> m.getId().getUserId())
                .toList();
    }

    private void validateGroupsExist(List<UUID> groupIds) {
        for (UUID groupId : distinct(groupIds)) {
            if (!userGroupRepository.existsById(groupId)) {
                throw new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Unknown group id: " + groupId);
            }
        }
    }

    private void validateUsersExist(List<UUID> userIds) {
        for (UUID userId : distinct(userIds)) {
            if (!appUserRepository.existsById(userId)) {
                throw new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Unknown user id: " + userId);
            }
        }
    }

    private static List<UUID> distinct(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        Set<UUID> seen = new HashSet<>();
        return ids.stream().filter(seen::add).toList();
    }
}
