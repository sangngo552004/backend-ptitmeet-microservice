package com.ptitmeet.identity.dto.response;

import com.ptitmeet.identity.entity.User.AuthProvider;
import lombok.Data;

@Data
public class UserResponse {
    private String userId;
    private String email;
    private String fullName;
    private String avatarUrl;
    private AuthProvider authProvider;
}
