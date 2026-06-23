package com.ptitmeet.meeting.util;

import com.ptitmeet.meeting.repository.MeetingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
@RequiredArgsConstructor
public class MeetingCodeGenerator {
    private static final String CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
    private final SecureRandom random = new SecureRandom();
    private final MeetingRepository meetingRepository;

    public String generateUniqueCode() {
        String code;
        do {
            code = generate();
        } while (meetingRepository.existsByMeetingCode(code));
        return code;
    }

    private String generate() {
        return randomPart(3) + "-" + randomPart(4) + "-" + randomPart(3);
    }

    private String randomPart(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
