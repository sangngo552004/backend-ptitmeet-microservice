package com.ptitmeet.identity.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.identity.dto.request.*;
import com.ptitmeet.identity.dto.response.AuthResponse;
import com.ptitmeet.identity.dto.response.UserResponse;
import com.ptitmeet.identity.entity.User;
import com.ptitmeet.identity.mapper.UserMapper;
import com.ptitmeet.identity.repository.UserRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;
    private final JwtService jwtService;
    private final RedisTokenService redisTokenService;
    private final JavaMailSender mailSender;

    @Value("${google.client-id}")
    private String googleClientId;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Transactional
    public UserResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        User user = User.builder()
                .email(req.getEmail())
                .fullName(req.getFullName())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .authProvider(User.AuthProvider.LOCAL)
                .build();

        user = userRepository.save(user);
        return userMapper.toUserResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (user.getAuthProvider() != User.AuthProvider.LOCAL) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        return generateTokensAndResponse(user);
    }

    @Transactional
    public AuthResponse loginWithGoogle(GoogleLoginRequest req) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(req.getIdToken());
            if (idToken == null) {
                throw new AppException(ErrorCode.UNAUTHORIZED);
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            String name = (String) payload.get("name");
            String sub = payload.getSubject();
            String picture = (String) payload.get("picture");

            User user = userRepository.findByEmail(email).orElse(null);

            if (user != null) {
                if (user.getProviderId() == null) {
                    user.setProviderId(sub);
                }
                if (user.getAvatarUrl() == null && picture != null) {
                    user.setAvatarUrl(picture);
                }
                user = userRepository.save(user);
            } else {
                user = User.builder()
                        .email(email)
                        .fullName(name)
                        .avatarUrl(picture)
                        .authProvider(User.AuthProvider.GOOGLE)
                        .providerId(sub)
                        .build();
                user = userRepository.save(user);
            }

            return generateTokensAndResponse(user);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Google login failed", e);
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    public void forgotPassword(ForgotPasswordRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        String token = UUID.randomUUID().toString();
        redisTokenService.saveResetToken(token, user.getUserId());

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(req.getEmail());
            helper.setSubject("PTITMeet — Đặt lại mật khẩu");
            String resetLink = frontendUrl + "/reset-password?token=" + token;
            String content = "<h3>Xin chào " + user.getFullName() + ",</h3>"
                    + "<p>Vui lòng click vào link sau để đặt lại mật khẩu của bạn:</p>"
                    + "<p><a href=\"" + resetLink + "\">" + resetLink + "</a></p>"
                    + "<p>Link này sẽ hết hạn trong 15 phút.</p>";
            helper.setText(content, true);
            mailSender.send(message);
        } catch (Exception e) {
            log.error("Failed to send forgot password email", e);
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        String userId = redisTokenService.getUserIdFromResetToken(req.getToken());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    public AuthResponse refreshToken(RefreshTokenRequest req) {
        String rawToken = req.getRefreshToken();
        String userId = redisTokenService.getUserIdFromRefreshToken(rawToken);

        if (userId == null) {
            throw new AppException(ErrorCode.REFRESH_TOKEN_INVALID);
        }

        redisTokenService.deleteRefreshToken(redisTokenService.sha256(rawToken));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return generateTokensAndResponse(user);
    }

    public void logout(String accessToken, String rawRefreshToken) {
        String jti = jwtService.extractJti(accessToken);
        long ttlSeconds = jwtService.getRemainingTtlSeconds(accessToken);

        if (ttlSeconds > 0) {
            redisTokenService.blacklistAccessToken(jti, ttlSeconds);
        }

        if (rawRefreshToken != null && !rawRefreshToken.isEmpty()) {
            redisTokenService.deleteRefreshToken(redisTokenService.sha256(rawRefreshToken));
        }
    }

    private AuthResponse generateTokensAndResponse(User user) {
        String accessToken = jwtService.generateAccessToken(user.getUserId(), user.getEmail());
        String refreshToken = jwtService.generateRefreshToken();

        redisTokenService.saveRefreshToken(user.getUserId(), refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(userMapper.toUserResponse(user))
                .build();
    }
}
