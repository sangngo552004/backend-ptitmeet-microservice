package com.ptitmeet.identity.grpc;

import com.ptitmeet.grpc.identity.*;
import com.ptitmeet.identity.entity.User;
import com.ptitmeet.identity.repository.UserRepository;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import net.devh.boot.grpc.server.service.GrpcService;

import java.util.List;

@GrpcService
@RequiredArgsConstructor
public class IdentityGrpcServiceImpl extends IdentityGrpcServiceGrpc.IdentityGrpcServiceImplBase {

    private final UserRepository userRepository;

    @Override
    public void getUserById(GetUserRequest request, StreamObserver<UserInfoResponse> responseObserver) {
        try {
            User user = userRepository.findById(request.getUserId())
                    .orElseThrow(() -> new StatusRuntimeException(
                            Status.NOT_FOUND.withDescription("User not found: " + request.getUserId())));

            responseObserver.onNext(buildUserInfoResponse(user));
            responseObserver.onCompleted();
        } catch (StatusRuntimeException e) {
            responseObserver.onError(e);
        }
    }

    @Override
    public void getUsersBatch(GetUsersBatchRequest request, StreamObserver<UserListResponse> responseObserver) {
        List<User> users = userRepository.findAllById(request.getUserIdsList());
        List<UserInfoResponse> responses = users.stream()
                .map(this::buildUserInfoResponse).toList();
        responseObserver.onNext(UserListResponse.newBuilder().addAllUsers(responses).build());
        responseObserver.onCompleted();
    }

    private UserInfoResponse buildUserInfoResponse(User user) {
        return UserInfoResponse.newBuilder()
                .setUserId(user.getUserId())
                .setEmail(user.getEmail())
                .setFullName(user.getFullName())
                .setAvatarUrl(user.getAvatarUrl() != null ? user.getAvatarUrl() : "")
                .setAuthProvider(user.getAuthProvider().name())
                .build();
    }
}
