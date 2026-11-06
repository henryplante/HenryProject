package com.clearpath.review.web.users;

import com.clearpath.review.service.setup.SetupDtos.UserDto;
import com.clearpath.review.service.setup.SetupDtos.UserInputDto;
import com.clearpath.review.service.setup.UserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserDto> listUsers() {
        return userService.listUsers();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto createUser(@Valid @RequestBody UserInputDto body) {
        return userService.createUser(body);
    }

    @PatchMapping("/{id}")
    public UserDto updateUser(@PathVariable UUID id, @Valid @RequestBody UserInputDto body) {
        return userService.updateUser(id, body);
    }
}
