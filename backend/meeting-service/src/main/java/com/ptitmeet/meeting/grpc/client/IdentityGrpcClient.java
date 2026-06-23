package com.ptitmeet.meeting.grpc.client;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.grpc.identity.GetUserRequest;
import com.ptitmeet.grpc.identity.GetUsersBatchRequest;
import com.ptitmeet.grpc.identity.IdentityGrpcServiceGrpc;
import com.ptitmeet.grpc.identity.UserInfoResponse;
import com.ptitmeet.grpc.identity.UserListResponse;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class IdentityGrpcClient {

    @GrpcClient("identity-grpc-client")
    private IdentityGrpcServiceGrpc.IdentityGrpcServiceBlockingStub identityStub;

    public UserInfoResponse getUserById(String userId) {
        try {
            return identityStub.getUserById(
                    GetUserRequest.newBuilder().setUserId(userId).build());
        } catch (StatusRuntimeException e) {
            if (e.getStatus().getCode() == Status.Code.NOT_FOUND) {
                throw new AppException(ErrorCode.USER_NOT_FOUND);
            }
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public List<UserInfoResponse> getUsersBatch(List<String> userIds) {
        try {
            UserListResponse response = identityStub.getUsersBatch(
                    GetUsersBatchRequest.newBuilder().addAllUserIds(userIds).build());
            return response.getUsersList();
        } catch (StatusRuntimeException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }
}
