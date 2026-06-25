package com.ptitmeet.identity.controller;

import com.ptitmeet.common.dto.ApiResponse;
import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.identity.config.JwtProperties;
import com.ptitmeet.identity.dto.request.*;
import com.ptitmeet.identity.dto.response.AuthResponse;
import com.ptitmeet.identity.dto.response.UserResponse;
import com.ptitmeet.identity.dto.response.VerifyResetOtpResponse;
import com.ptitmeet.identity.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_TOKEN_COOKIE = "ptitmeet_refresh_token";

    private final AuthService authService;
    private final JwtProperties jwtProperties;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponse>> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.ok(ApiResponse.success(authService.register(req)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        return authResponse(authService.login(req));
    }

    @PostMapping("/google")
    public ResponseEntity<ApiResponse<AuthResponse>> loginWithGoogle(@Valid @RequestBody GoogleLoginRequest req) {
        return authResponse(authService.loginWithGoogle(req));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        authService.forgotPassword(req);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/forgot-password-mobile")
    public ResponseEntity<ApiResponse<Void>> forgotPasswordMobile(@Valid @RequestBody ForgotPasswordRequest req) {
        authService.forgotPasswordMobile(req);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/verify-reset-otp")
    public ResponseEntity<ApiResponse<VerifyResetOtpResponse>> verifyResetOtp(
            @Valid @RequestBody VerifyResetOtpRequest req) {
        return ResponseEntity.ok(ApiResponse.success(authService.verifyResetOtp(req)));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        authService.resetPassword(req);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            HttpServletRequest request,
            @RequestBody(required = false) RefreshTokenRequest req) {
        String refreshToken = resolveRefreshToken(req != null ? req.getRefreshToken() : null, request);
        if (!StringUtils.hasText(refreshToken)) {
            throw new AppException(ErrorCode.REFRESH_TOKEN_INVALID);
        }

        RefreshTokenRequest effectiveReq = new RefreshTokenRequest();
        effectiveReq.setRefreshToken(refreshToken);
        return authResponse(authService.refreshToken(effectiveReq));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest request, @RequestBody(required = false) LogoutRequest req) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String accessToken = authHeader.substring(7);
            String refreshToken = resolveRefreshToken(req != null ? req.getRefreshToken() : null, request);
            authService.logout(accessToken, refreshToken);
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearRefreshTokenCookie().toString())
                .body(ApiResponse.success(null));
    }

    private ResponseEntity<ApiResponse<AuthResponse>> authResponse(AuthResponse authResponse) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie(authResponse.getRefreshToken()).toString())
                .body(ApiResponse.success(authResponse));
    }

    private String resolveRefreshToken(String refreshToken, HttpServletRequest request) {
        if (StringUtils.hasText(refreshToken)) {
            return refreshToken;
        }
        return getCookieValue(request, REFRESH_TOKEN_COOKIE);
    }

    private String getCookieValue(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private ResponseCookie refreshTokenCookie(String refreshToken) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, refreshToken)
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(jwtProperties.getRefreshTokenExpiration())
                .build();
    }

    private ResponseCookie clearRefreshTokenCookie() {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(0)
                .build();
    }
}
