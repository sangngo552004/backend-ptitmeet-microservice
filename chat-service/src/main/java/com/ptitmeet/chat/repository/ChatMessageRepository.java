package com.ptitmeet.chat.repository;

import com.ptitmeet.chat.document.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {

    // Lấy lịch sử chat theo meeting_code, sort by timestamp ASC
    List<ChatMessage> findByMeetingCodeOrderByTimestampAsc(String meetingCode);

    // Phân trang nếu cần
    Page<ChatMessage> findByMeetingCodeOrderByTimestampDesc(String meetingCode, Pageable pageable);

    // Đếm tin nhắn (dùng cho Meeting Summary)
    long countByMeetingCode(String meetingCode);
}
