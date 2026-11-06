package com.clearpath.review.service.setup;

import com.clearpath.review.domain.UserGroup;
import com.clearpath.review.domain.UserGroupRepository;
import com.clearpath.review.service.setup.SetupDtos.GroupDto;
import com.clearpath.review.service.setup.SetupDtos.GroupInputDto;
import com.clearpath.review.service.setup.SetupDtos.GroupMembersInputDto;
import com.clearpath.review.web.error.ApiException;
import com.clearpath.review.web.error.ErrorCode;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GroupService {

    private final UserGroupRepository userGroupRepository;
    private final MembershipSync membershipSync;

    public GroupService(UserGroupRepository userGroupRepository, MembershipSync membershipSync) {
        this.userGroupRepository = userGroupRepository;
        this.membershipSync = membershipSync;
    }

    @Transactional(readOnly = true)
    public List<GroupDto> listGroups() {
        return userGroupRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public GroupDto createGroup(GroupInputDto input) {
        ensureNameAvailable(input.name(), null);
        UserGroup group = EntityFactory.create(UserGroup.class);
        group.setId(UUID.randomUUID());
        group.setName(input.name());
        userGroupRepository.save(group);
        return toDto(group);
    }

    @Transactional
    public GroupDto updateGroup(UUID id, GroupInputDto input) {
        UserGroup group = userGroupRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Not found"));
        ensureNameAvailable(input.name(), id);
        group.setName(input.name());
        return toDto(group);
    }

    @Transactional
    public GroupDto replaceMembers(UUID id, GroupMembersInputDto input) {
        if (!userGroupRepository.existsById(id)) {
            throw new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, "Not found");
        }
        membershipSync.replaceGroupMembers(id, input.userIds());
        UserGroup group = userGroupRepository.getReferenceById(id);
        return toDto(group);
    }

    private GroupDto toDto(UserGroup group) {
        return new GroupDto(group.getId(), group.getName(), membershipSync.memberIdsForGroup(group.getId()));
    }

    private void ensureNameAvailable(String name, UUID exceptGroupId) {
        boolean taken = userGroupRepository.findAllByNameIgnoreCase(name).stream()
                .anyMatch(existing -> exceptGroupId == null || !existing.getId().equals(exceptGroupId));
        if (taken) {
            throw new ApiException(ErrorCode.VALIDATION, HttpStatus.BAD_REQUEST, "Group name already in use");
        }
    }
}
