package com.ptitmeet.identity.service;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.identity.dto.request.UpdateProfileRequest;
import com.ptitmeet.identity.dto.response.UserResponse;
import com.ptitmeet.identity.entity.User;
import com.ptitmeet.identity.mapper.UserMapper;
import com.ptitmeet.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final S3Client s3Client;

    @Value("${aws.s3.bucket}")
    private String bucket;

    @Value("${aws.s3.region}")
    private String region;

    @Value("${aws.s3.avatar-prefix}")
    private String avatarPrefix;

    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList("image/jpeg", "image/png", "image/webp");
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    public UserResponse getProfile(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return userMapper.toUserResponse(user);
    }

    @Transactional
    public UserResponse updateProfile(String userId, UpdateProfileRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.setFullName(req.getFullName());
        if (req.getAvatarUrl() != null) {
            user.setAvatarUrl(req.getAvatarUrl());
        }

        user = userRepository.save(user);
        return userMapper.toUserResponse(user);
    }

    @Transactional
    public UserResponse uploadAvatar(String userId, MultipartFile file) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (file.isEmpty() || file.getSize() > MAX_FILE_SIZE) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_EXTENSIONS.contains(contentType)) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        String ext = contentType.split("/")[1];
        String key = avatarPrefix + userId + "/" + UUID.randomUUID() + "." + ext;

        try {
            s3Client.putObject(PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            String url = String.format("https://%s.s3.%s.amazonaws.com/%s", bucket, region, key);
            user.setAvatarUrl(url);
            user = userRepository.save(user);

            return userMapper.toUserResponse(user);
        } catch (IOException e) {
            log.error("Failed to upload avatar", e);
            throw new AppException(ErrorCode.STORAGE_ERROR);
        }
    }
}
