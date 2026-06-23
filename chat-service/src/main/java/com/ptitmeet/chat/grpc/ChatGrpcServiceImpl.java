package com.ptitmeet.chat.grpc;

import com.ptitmeet.chat.document.ChatMessage;
import com.ptitmeet.grpc.chat.*;
import com.ptitmeet.chat.repository.ChatMessageRepository;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import net.devh.boot.grpc.server.service.GrpcService;

import java.util.List;

@GrpcService
@RequiredArgsConstructor
public class ChatGrpcServiceImpl extends ChatGrpcServiceGrpc.ChatGrpcServiceImplBase {

    private final ChatMessageRepository chatMessageRepository;

    @Override
    public void getChatHistory(GetChatHistoryRequest request,
            StreamObserver<ChatHistoryResponse> responseObserver) {
        List<ChatMessage> messages = chatMessageRepository
                .findByMeetingCodeOrderByTimestampAsc(request.getMeetingCode());

        ChatHistoryResponse.Builder builder = ChatHistoryResponse.newBuilder();
        messages.forEach(m -> builder.addMessages(
                com.ptitmeet.grpc.chat.ChatMessage.newBuilder()
                        .setId(m.getId())
                        .setMeetingCode(m.getMeetingCode())
                        .setSenderId(m.getSenderId())
                        .setSenderName(m.getSenderName())
                        .setContent(m.getContent())
                        .setTimestamp(String.valueOf(m.getTimestamp()))
                        .build()));

        responseObserver.onNext(builder.build());
        responseObserver.onCompleted();
    }

    @Override
    public void getMessageCount(GetMessageCountRequest request,
            StreamObserver<MessageCountResponse> responseObserver) {
        long count = chatMessageRepository.countByMeetingCode(request.getMeetingCode());
        responseObserver.onNext(MessageCountResponse.newBuilder().setCount(count).build());
        responseObserver.onCompleted();
    }
}
