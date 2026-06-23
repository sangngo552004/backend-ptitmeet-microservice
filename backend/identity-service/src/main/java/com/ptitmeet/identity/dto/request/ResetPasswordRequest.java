package com.ptitmeet.identity.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank
    private String token;

    @NotBlank
    @Size(min = 8, message = "Mật khẩu phải có ít nhất 8 ký tự")
    private String newPassword;
}
