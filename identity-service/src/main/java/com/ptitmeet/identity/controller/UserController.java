package com.ptitmeet.identity.controller;

import com.ptitmeet.common.dto.ApiResponse;
import com.ptitmeet.identity.dto.request.UpdateProfileRequest;
import com.ptitmeet.identity.dto.response.UserResponse;
import com.ptitmeet.identity.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    private String getUserId(HttpServletRequest request) {
        return request.getHeader("X-User-Id");
    }

    @GetMapping({"/me", "/profile"})
    public ResponseEntity<ApiResponse<UserResponse>> getProfile(HttpServletRequest request) {
        String userId = getUserId(request);
        return ResponseEntity.ok(ApiResponse.success(userService.getProfile(userId)));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(HttpServletRequest request,
                                                                   @Valid @RequestBody UpdateProfileRequest req) {
        String userId = getUserId(request);
        return ResponseEntity.ok(ApiResponse.success(userService.updateProfile(userId, req)));
    }

    @PostMapping("/avatar")
    public ResponseEntity<ApiResponse<UserResponse>> uploadAvatar(HttpServletRequest request,
                                                                  @RequestParam("file") MultipartFile file) {
        String userId = getUserId(request);
        return ResponseEntity.ok(ApiResponse.success(userService.uploadAvatar(userId, file)));
    }
}
