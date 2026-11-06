package com.clearpath.review.web.groups;

import com.clearpath.review.service.setup.GroupService;
import com.clearpath.review.service.setup.SetupDtos.GroupDto;
import com.clearpath.review.service.setup.SetupDtos.GroupInputDto;
import com.clearpath.review.service.setup.SetupDtos.GroupMembersInputDto;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping
    public List<GroupDto> listGroups() {
        return groupService.listGroups();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupDto createGroup(@Valid @RequestBody GroupInputDto body) {
        return groupService.createGroup(body);
    }

    @PatchMapping("/{id}")
    public GroupDto updateGroup(@PathVariable UUID id, @Valid @RequestBody GroupInputDto body) {
        return groupService.updateGroup(id, body);
    }

    @PutMapping("/{id}/members")
    public GroupDto replaceMembers(@PathVariable UUID id, @Valid @RequestBody GroupMembersInputDto body) {
        return groupService.replaceMembers(id, body);
    }
}
