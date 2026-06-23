package com.ptitmeet.identity.controller;

import com.ptitmeet.identity.dto.response.UserResponse;
import com.ptitmeet.identity.service.UserService;
import com.ptitmeet.identity.repository.UserRepository;
import com.ptitmeet.identity.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/internal/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @GetMapping("/{userId}")
    public UserResponse getUser(@PathVariable String userId) {
        return userService.getProfile(userId);
    }

    @PostMapping("/batch")
    public List<UserResponse> getUsersBatch(@RequestBody List<String> userIds) {
        return userRepository.findAllById(userIds).stream()
                .map(userMapper::toUserResponse)
                .collect(Collectors.toList());
    }
}
