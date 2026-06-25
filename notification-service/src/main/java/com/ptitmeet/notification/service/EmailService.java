package com.ptitmeet.notification.service;

import com.ptitmeet.notification.entity.NotificationLog;
import com.ptitmeet.notification.repository.NotificationLogRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final NotificationLogRepository notificationLogRepository;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public void sendMeetingInvitation(String email, String meetingCode, String title, String startTime) {
        NotificationLog notificationLog = NotificationLog.builder()
                .meetingCode(meetingCode)
                .recipientEmail(email)
                .build();

        try {
            // Prepare Thymeleaf Context
            Context context = new Context();
            context.setVariable("title", title != null ? title : "Cuộc họp PTITMeet");
            context.setVariable("meetingCode", meetingCode);
            context.setVariable("startTime", startTime != null ? startTime : "Tham gia ngay");
            context.setVariable("joinLink", frontendUrl + "/" + meetingCode); // Adjusted based on standard routing

            // Process Template
            String process = templateEngine.process("meeting-invitation", context);

            // Create MimeMessage
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(email);
            helper.setSubject("Lời mời tham gia phòng họp PTITMeet: " + meetingCode);
            helper.setText(process, true);

            // Send Email
            mailSender.send(mimeMessage);

            // Log Success
            notificationLog.setStatus(NotificationLog.NotificationStatus.SENT);
            log.info("Invitation email sent successfully to {}", email);

        } catch (Exception e) {
            // Log Failure
            notificationLog.setStatus(NotificationLog.NotificationStatus.FAILED);
            notificationLog.setErrorMessage(e.getMessage());
            log.error("Failed to send invitation email to {}: {}", email, e.getMessage());
        } finally {
            // Save log to DB
            notificationLogRepository.save(notificationLog);
        }
    }
}
