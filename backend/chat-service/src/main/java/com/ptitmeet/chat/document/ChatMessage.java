package com.ptitmeet.chat.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;

@Document(collection = "meeting_chats")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ChatMessage {

    @Id
    private String id;

    @Indexed
    @Field("meeting_code")
    private String meetingCode;

    @Field("sender_id")
    private String senderId;       // Raw UUID

    @Field("sender_name")
    private String senderName;     // Snapshot tại thời điểm gửi

    private String content;

    @Field("timestamp")
    private LocalDateTime timestamp;
}
