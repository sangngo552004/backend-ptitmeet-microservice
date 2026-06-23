package com.ptitmeet.meeting.grpc.client;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.grpc.chat.ChatGrpcServiceGrpc;
import com.ptitmeet.grpc.chat.ChatHistoryResponse;
import com.ptitmeet.grpc.chat.GetChatHistoryRequest;
import com.ptitmeet.grpc.chat.GetMessageCountRequest;
import com.ptitmeet.grpc.chat.MessageCountResponse;
import io.grpc.StatusRuntimeException;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Service;

@Service
public class ChatGrpcClient {

    @GrpcClient("chat-grpc-client")
    private ChatGrpcServiceGrpc.ChatGrpcServiceBlockingStub chatStub;

    public ChatHistoryResponse getChatHistory(String meetingCode) {
        try {
            return chatStub.getChatHistory(
                    GetChatHistoryRequest.newBuilder().setMeetingCode(meetingCode).build());
        } catch (StatusRuntimeException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public MessageCountResponse getMessageCount(String meetingCode) {
        try {
            return chatStub.getMessageCount(
                    GetMessageCountRequest.newBuilder().setMeetingCode(meetingCode).build());
        } catch (StatusRuntimeException e) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }
}
