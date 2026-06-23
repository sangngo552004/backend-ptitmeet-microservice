package com.ptitmeet.meeting.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.grpc.identity.UserInfoResponse;
import com.ptitmeet.grpc.chat.ChatHistoryResponse;
import com.ptitmeet.grpc.chat.MessageCountResponse;
import com.ptitmeet.grpc.media.RecordingResponse;
import com.ptitmeet.meeting.dto.event.ApprovalResult;
import com.ptitmeet.meeting.dto.event.SystemEvent;
import com.ptitmeet.meeting.dto.event.WaitingRoomNotification;
import com.ptitmeet.meeting.dto.request.*;
import com.ptitmeet.meeting.dto.response.*;
import com.ptitmeet.meeting.entity.*;
import com.ptitmeet.meeting.grpc.client.ChatGrpcClient;
import com.ptitmeet.meeting.grpc.client.IdentityGrpcClient;
import com.ptitmeet.meeting.grpc.client.MediaGrpcClient;
import com.ptitmeet.meeting.mapper.MeetingMapper;
import com.ptitmeet.meeting.repository.*;
import com.ptitmeet.meeting.service.LiveKitService;
import com.ptitmeet.meeting.service.MeetingService;
import com.ptitmeet.meeting.util.MeetingCodeGenerator;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MeetingServiceImpl implements MeetingService {

    private final MeetingRepository meetingRepository;
    private final ParticipantRepository participantRepository;
    private final ParticipantSessionRepository participantSessionRepository;
    private final MeetingInvitationRepository meetingInvitationRepository;
    private final MeetingFeedbackRepository meetingFeedbackRepository;
    private final OutboxEventRepository outboxEventRepository;
    private final LiveKitService liveKitService;
    private final MeetingCodeGenerator codeGenerator;
    private final MeetingMapper meetingMapper;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;
    private final IdentityGrpcClient identityGrpcClient;
    private final ChatGrpcClient chatGrpcClient;
    private final MediaGrpcClient mediaGrpcClient;

    private static final String DEFAULT_SETTINGS =
            "{\"waitingRoom\":true,\"muteOnEntry\":false,\"cameraOffOnEntry\":false,\"allowChat\":true,\"allowScreenShare\":true}";

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 04
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public MeetingResponse createInstantMeeting(String userId, String userName) {
        String meetingCode = codeGenerator.generateUniqueCode();

        Meeting meeting = Meeting.builder()
                .hostId(userId).ownerId(userId).meetingCode(meetingCode)
                .title("Instant Meeting").isInstant(true)
                .status(Meeting.MeetingStatus.ACTIVE).accessType(Meeting.AccessType.OPEN)
                .settings(DEFAULT_SETTINGS).startTime(LocalDateTime.now())
                .build();
        meeting = meetingRepository.save(meeting);

        Participant hostParticipant = participantRepository.save(Participant.builder()
                .meeting(meeting).userId(userId)
                .displayName(userName != null ? userName : "Host")
                .role(Participant.Role.HOST).approvalStatus(Participant.ApprovalStatus.APPROVED)
                .build());

        participantSessionRepository.save(ParticipantSession.builder()
                .participant(hostParticipant).status(ParticipantSession.SessionStatus.ACTIVE)
                .build());

        String token = liveKitService.generateJoinToken(meetingCode, userId, hostParticipant.getDisplayName(), true);
        MeetingResponse response = meetingMapper.toResponse(meeting);
        response.setJoinToken(token);
        return response;
    }

    @Override
    @Transactional
    public MeetingResponse scheduleMeeting(String userId, CreateMeetingRequest req) {
        if (req.getStartTime() != null && req.getStartTime().isBefore(LocalDateTime.now())) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }
        if (req.getEndTime() != null && req.getStartTime() != null
                && req.getEndTime().isBefore(req.getStartTime())) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        String meetingCode = codeGenerator.generateUniqueCode();
        Meeting meeting = meetingRepository.save(Meeting.builder()
                .hostId(userId).ownerId(userId).meetingCode(meetingCode)
                .title(req.getTitle()).isInstant(false).status(Meeting.MeetingStatus.SCHEDULED)
                .accessType(Meeting.AccessType.valueOf(req.getAccessType()))
                .password(req.getPassword()).allowedDomain(req.getAllowedDomain())
                .startTime(req.getStartTime()).endTime(req.getEndTime())
                .settings(req.getSettings() != null ? req.getSettings() : DEFAULT_SETTINGS)
                .build());

        List<String> emails = req.getParticipantEmails();
        if (emails != null && !emails.isEmpty()) {
            emails.forEach(email -> meetingInvitationRepository.save(
                    MeetingInvitation.builder().meeting(meeting).email(email).build()));
            try {
                Map<String, Object> payload = new HashMap<>();
                payload.put("title", meeting.getTitle());
                payload.put("meetingCode", meeting.getMeetingCode());
                payload.put("startTime", meeting.getStartTime() != null ? meeting.getStartTime().toString() : null);
                payload.put("endTime", meeting.getEndTime() != null ? meeting.getEndTime().toString() : null);
                payload.put("invitedEmails", emails);
                outboxEventRepository.save(OutboxEvent.builder()
                        .aggregateType("MEETING").aggregateId(meeting.getMeetingId())
                        .eventType("MEETING_SCHEDULED").payload(objectMapper.writeValueAsString(payload))
                        .status(OutboxEvent.OutboxStatus.PENDING).build());
            } catch (JsonProcessingException e) {
                throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
            }
        }
        return meetingMapper.toResponse(meeting);
    }

    @Override
    @Transactional
    public void cancelMeeting(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        if (!meeting.getOwnerId().equals(userId)) throw new AppException(ErrorCode.ONLY_OWNER);
        if (meeting.getStatus() != Meeting.MeetingStatus.SCHEDULED) throw new AppException(ErrorCode.MEETING_NOT_ACTIVE);
        meeting.setStatus(Meeting.MeetingStatus.CANCELED);
        meetingRepository.save(meeting);
    }

    @Override
    public List<MeetingResponse> getMyMeetings(String userId) {
        return meetingRepository.findByOwnerIdOrHostId(userId, userId)
                .stream().map(meetingMapper::toResponse).collect(Collectors.toList());
    }

    @Override
    public MeetingInfoResponse getMeetingInfo(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        
        String hostName = "Host";
        try {
            UserInfoResponse userInfo = identityGrpcClient.getUserById(meeting.getHostId());
            hostName = userInfo.getFullName();
        } catch (AppException e) {
            log.warn("Could not fetch host name for meeting {}: {}", meetingCode, e.getMessage());
        }

        return MeetingInfoResponse.builder()
                .meetingCode(meeting.getMeetingCode()).title(meeting.getTitle())
                .hostName(hostName).status(meeting.getStatus().name())
                .accessType(meeting.getAccessType().name())
                .isPasswordProtected(meeting.getPassword() != null && !meeting.getPassword().isEmpty())
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 05: Join Flow
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public JoinMeetingResponse joinMeeting(String userId, String userEmail,
                                           String meetingCode, JoinMeetingRequest req,
                                           HttpServletRequest httpRequest) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

        if (meeting.getStatus() == Meeting.MeetingStatus.FINISHED
                || meeting.getStatus() == Meeting.MeetingStatus.CANCELED) {
            throw new AppException(ErrorCode.MEETING_NOT_ACTIVE);
        }

        boolean isOwner = userId.equals(meeting.getOwnerId());
        boolean isRuntimeHost = userId.equals(meeting.getHostId());
        boolean isPrivileged = isOwner || isRuntimeHost;

        if (meeting.getStatus() == Meeting.MeetingStatus.SCHEDULED) {
            if (!isPrivileged) {
                return JoinMeetingResponse.builder()
                        .status("PENDING").message("Meeting chưa bắt đầu. Vui lòng chờ host khai mạc.")
                        .currentHostId(meeting.getHostId()).build();
            }
            meeting.setStatus(Meeting.MeetingStatus.ACTIVE);
            meetingRepository.save(meeting);
        }

        if (!isPrivileged) checkAccessType(meeting, userEmail);

        if (!isPrivileged && meeting.getPassword() != null && !meeting.getPassword().isBlank()) {
            if (req.getPassword() == null || !meeting.getPassword().equals(req.getPassword())) {
                throw new AppException(ErrorCode.WRONG_PASSWORD);
            }
        }

        Participant participant = participantRepository
                .findByMeetingAndUserId(meeting, userId).orElse(null);
        if (participant == null) {
            participant = participantRepository.save(Participant.builder()
                    .meeting(meeting).userId(userId)
                    .displayName(resolveDisplayName(req.getDisplayName(), userId))
                    .role(isPrivileged ? Participant.Role.HOST : Participant.Role.GUEST)
                    .approvalStatus(Participant.ApprovalStatus.PENDING).build());
        }

        Optional<ParticipantSession> latestSession = participantSessionRepository
                .findTopByParticipantOrderByJoinedAtDesc(participant);
        if (latestSession.isPresent()
                && latestSession.get().getStatus() == ParticipantSession.SessionStatus.KICKED) {
            participant.setApprovalStatus(Participant.ApprovalStatus.PENDING);
            participantRepository.save(participant);
        }

        boolean waitingRoomEnabled = parseWaitingRoomSetting(meeting.getSettings());
        boolean shouldGoToWaiting = !isPrivileged && waitingRoomEnabled
                && participant.getApprovalStatus() != Participant.ApprovalStatus.APPROVED;

        if (shouldGoToWaiting) {
            participant.setApprovalStatus(Participant.ApprovalStatus.PENDING);
            final Participant saved = participantRepository.save(participant);
            messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode + "/host",
                    WaitingRoomNotification.builder().action("JOIN_REQUEST")
                            .participantId(saved.getParticipantId()).userId(userId)
                            .displayName(saved.getDisplayName()).requestTime(LocalDateTime.now()).build());
            return JoinMeetingResponse.builder()
                    .status("PENDING").message("Yêu cầu của bạn đang chờ host phê duyệt.")
                    .currentHostId(meeting.getHostId()).settings(meeting.getSettings()).build();
        }

        participant.setApprovalStatus(Participant.ApprovalStatus.APPROVED);
        participantRepository.save(participant);

        participantSessionRepository
                .findByParticipantAndStatus(participant, ParticipantSession.SessionStatus.ACTIVE)
                .ifPresent(oldSession -> {
                    oldSession.setStatus(ParticipantSession.SessionStatus.LEFT);
                    oldSession.setLeftAt(LocalDateTime.now());
                    participantSessionRepository.save(oldSession);
                });

        participantSessionRepository.save(ParticipantSession.builder()
                .participant(participant).status(ParticipantSession.SessionStatus.ACTIVE)
                .deviceInfo(httpRequest.getHeader("User-Agent"))
                .ipAddress(httpRequest.getRemoteAddr()).build());

        String livekitToken = liveKitService.generateJoinToken(
                meetingCode, userId, participant.getDisplayName(), isPrivileged);

        return JoinMeetingResponse.builder()
                .status("APPROVED").message("Bạn đã được vào phòng họp.")
                .token(livekitToken).serverUrl(liveKitService.getLivekitServerUrl())
                .role(participant.getRole().name()).isOwner(isOwner)
                .currentHostId(meeting.getHostId()).settings(meeting.getSettings()).build();
    }

    @Override
    public List<ParticipantResponse> getWaitingRoom(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        if (!userId.equals(meeting.getHostId()) && !userId.equals(meeting.getOwnerId())) {
            throw new AppException(ErrorCode.ONLY_HOST);
        }
        return participantRepository.findByMeetingAndApprovalStatus(meeting, Participant.ApprovalStatus.PENDING)
                .stream().map(p -> ParticipantResponse.builder()
                        .participantId(p.getParticipantId()).userId(p.getUserId())
                        .displayName(p.getDisplayName()).email(null).avatarUrl(null)
                        .status(p.getApprovalStatus().name()).requestTime(p.getCreatedAt()).build())
                .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 06: Leave, End, Approve, Host Controls
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void leaveMeeting(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        if (meeting.getStatus() != Meeting.MeetingStatus.ACTIVE) return;

        Participant participant = participantRepository
                .findByMeetingAndUserId(meeting, userId)
                .orElseThrow(() -> new AppException(ErrorCode.PARTICIPANT_NOT_FOUND));

        participantSessionRepository
                .findByParticipantAndStatus(participant, ParticipantSession.SessionStatus.ACTIVE)
                .ifPresent(session -> {
                    session.setStatus(ParticipantSession.SessionStatus.LEFT);
                    session.setLeftAt(LocalDateTime.now());
                    participantSessionRepository.save(session);
                });

        long activeCount = participantSessionRepository
                .countByParticipant_Meeting_MeetingCodeAndStatus(meetingCode, ParticipantSession.SessionStatus.ACTIVE);
        if (activeCount == 0) {
            meeting.setStatus(Meeting.MeetingStatus.FINISHED);
            meeting.setEndTime(LocalDateTime.now());
            meetingRepository.save(meeting);
            return;
        }

        if (userId.equals(meeting.getHostId())) {
            participantSessionRepository
                    .findFirstByParticipant_Meeting_MeetingCodeAndStatusAndParticipant_UserIdNot(
                            meetingCode, ParticipantSession.SessionStatus.ACTIVE, userId)
                    .ifPresent(nextSession -> {
                        String newHostId = nextSession.getParticipant().getUserId();
                        String newHostName = nextSession.getParticipant().getDisplayName();
                        meeting.setHostId(newHostId);
                        meetingRepository.save(meeting);
                        messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
                                SystemEvent.builder().action("HOST_TRANSFERRED")
                                        .newHostId(newHostId).newHostName(newHostName).build());
                    });
        }
    }

    @Override
    @Transactional
    public void endForAll(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        if (!userId.equals(meeting.getHostId())) throw new AppException(ErrorCode.ONLY_HOST);

        List<ParticipantSession> activeSessions = participantSessionRepository
                .findAllByParticipant_Meeting_MeetingCodeAndStatus(meetingCode, ParticipantSession.SessionStatus.ACTIVE);
        activeSessions.forEach(s -> {
            s.setStatus(ParticipantSession.SessionStatus.ENDED_BY_HOST);
            s.setLeftAt(LocalDateTime.now());
        });
        participantSessionRepository.saveAll(activeSessions);

        meeting.setStatus(Meeting.MeetingStatus.FINISHED);
        meeting.setEndTime(LocalDateTime.now());
        meetingRepository.save(meeting);

        messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
                SystemEvent.builder().action("END_MEETING_FOR_ALL").build());
    }

    @Override
    @Transactional
    public void approveParticipant(String hostUserId, String meetingCode, ApprovalRequest req) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        if (!hostUserId.equals(meeting.getHostId())) throw new AppException(ErrorCode.ONLY_HOST);

        Participant participant = participantRepository.findById(req.getParticipantId())
                .orElseThrow(() -> new AppException(ErrorCode.PARTICIPANT_NOT_FOUND));

        if ("APPROVED".equals(req.getAction())) {
            participant.setApprovalStatus(Participant.ApprovalStatus.APPROVED);
            participantRepository.save(participant);
            participantSessionRepository.save(ParticipantSession.builder()
                    .participant(participant).status(ParticipantSession.SessionStatus.ACTIVE).build());
            String token = liveKitService.generateJoinToken(
                    meetingCode, participant.getUserId(), participant.getDisplayName(), false);
            messagingTemplate.convertAndSendToUser(participant.getUserId(), "/queue/approval",
                    ApprovalResult.builder().action("APPROVED").token(token)
                            .serverUrl(liveKitService.getLivekitServerUrl())
                            .role("GUEST").message("Bạn đã được vào phòng.").build());
        } else if ("REJECTED".equals(req.getAction())) {
            participant.setApprovalStatus(Participant.ApprovalStatus.REJECTED);
            participantRepository.save(participant);
            messagingTemplate.convertAndSendToUser(participant.getUserId(), "/queue/approval",
                    ApprovalResult.builder().action("REJECTED")
                            .message("Yêu cầu của bạn đã bị từ chối bởi host.").build());
        }
    }

    @Override
    @Transactional
    public void handleSystemAction(String userId, String meetingCode, SystemMessage message) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        if (!userId.equals(meeting.getHostId())) throw new AppException(ErrorCode.ONLY_HOST);

        if ("KICK_PARTICIPANT".equals(message.getAction()) && message.getTargetUserId() != null) {
            participantRepository.findByMeetingAndUserId(meeting, message.getTargetUserId())
                    .ifPresent(target -> participantSessionRepository
                            .findByParticipantAndStatus(target, ParticipantSession.SessionStatus.ACTIVE)
                            .ifPresent(session -> {
                                session.setStatus(ParticipantSession.SessionStatus.KICKED);
                                session.setLeftAt(LocalDateTime.now());
                                participantSessionRepository.save(session);
                            }));
        }

        messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
                SystemEvent.builder().action(message.getAction())
                        .targetUserId(message.getTargetUserId())
                        .egressId(message.getEgressId()).build());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 07: History, Summary, Feedback, Settings
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public Page<MeetingHistoryResponse> getHistory(
            String userId, int page, int size, String role, String status) {

        Pageable pageable = PageRequest.of(page - 1, size);
        // Resolve status enum (handle 'ALL' case)
        Meeting.MeetingStatus statusEnum = "ALL".equals(status) ? null : Meeting.MeetingStatus.valueOf(status);
        String statusParam = status;

        Page<Meeting> meetings = switch (role.toUpperCase()) {
            case "HOST" -> meetingRepository.findHostMeetingHistoryByUserId(
                    userId, statusParam, statusEnum, pageable);
            case "GUEST" -> meetingRepository.findGuestMeetingHistoryByUserId(
                    userId, statusParam, statusEnum, pageable);
            default -> meetingRepository.findMeetingHistoryByUserId(
                    userId, statusParam, statusEnum, pageable);
        };

        return meetings.map(m -> toHistoryResponse(m, userId));
    }

    @Override
    public MeetingHistoryResponse getUpNext(String userId) {
        return meetingRepository
                .findFirstByOwnerIdAndStatusAndStartTimeAfterOrderByStartTimeAsc(
                        userId, Meeting.MeetingStatus.SCHEDULED, LocalDateTime.now())
                .map(m -> toHistoryResponse(m, userId))
                .orElse(null);
    }

    @Override
    public MeetingSummaryResponse getSummary(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

        LocalDateTime end = meeting.getEndTime() != null ? meeting.getEndTime() : LocalDateTime.now();
        LocalDateTime start = meeting.getStartTime() != null ? meeting.getStartTime() : meeting.getCreatedAt();
        Duration duration = Duration.between(start, end);

        long participantCount = participantRepository.countDistinctUserIdByMeeting(meeting);

        int messageCount = 0;
        try {
            MessageCountResponse countResponse = chatGrpcClient.getMessageCount(meetingCode);
            messageCount = (int) countResponse.getCount();
        } catch (AppException e) {
            log.warn("Could not fetch message count: {}", e.getMessage());
        }

        return MeetingSummaryResponse.builder()
                .duration(formatDuration(duration))
                .participants((int) participantCount)
                .messages(messageCount)
                .build();
    }

    @Override
    public List<ChatMessageResponse> getChatHistory(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

        boolean isOwner = userId.equals(meeting.getOwnerId());
        boolean isActiveParticipant = participantSessionRepository
                .existsByParticipant_Meeting_MeetingCodeAndParticipant_UserIdAndStatus(
                        meetingCode, userId, ParticipantSession.SessionStatus.ACTIVE);

        if (!isOwner && !isActiveParticipant) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        try {
            ChatHistoryResponse historyResponse = chatGrpcClient.getChatHistory(meetingCode);
            return historyResponse.getMessagesList().stream()
                    .map(m -> ChatMessageResponse.builder()
                            .id(m.getId())
                            .meetingCode(m.getMeetingCode())
                            .senderId(m.getSenderId())
                            .senderName(m.getSenderName())
                            .content(m.getContent())
                            .timestamp(LocalDateTime.parse(m.getTimestamp()))
                            .build())
                    .toList();
        } catch (AppException e) {
            log.warn("Could not fetch chat history: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    @Transactional
    public void submitFeedback(String userId, String meetingCode, FeedbackRequest req) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

        if (meetingFeedbackRepository.existsByMeetingAndUserId(meeting, userId)) {
            throw new AppException(ErrorCode.FEEDBACK_ALREADY_SUBMITTED);
        }

        if (req.getRating() < 1 || req.getRating() > 5) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        meetingFeedbackRepository.save(MeetingFeedback.builder()
                .meeting(meeting).userId(userId).rating(req.getRating()).build());
    }

    @Override
    public String getSettings(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));
        return meeting.getSettings();
    }

    @Override
    @Transactional
    public MeetingResponse updateSettings(String userId, String meetingCode, Map<String, Object> newSettings) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

        if (!userId.equals(meeting.getOwnerId())) {
            throw new AppException(ErrorCode.ONLY_OWNER);
        }

        try {
            meeting.setSettings(objectMapper.writeValueAsString(newSettings));
            return meetingMapper.toResponse(meetingRepository.save(meeting));
        } catch (JsonProcessingException e) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private void checkAccessType(Meeting meeting, String userEmail) {
        switch (meeting.getAccessType()) {
            case OPEN -> { /* open to all */ }
            case TRUSTED -> {
                String domain = meeting.getAllowedDomain();
                if (domain == null || userEmail == null || !userEmail.endsWith("@" + domain)) {
                    throw new AppException(ErrorCode.ACCESS_DENIED);
                }
            }
            case RESTRICTED -> {
                if (!meetingInvitationRepository.existsByMeetingAndEmail(meeting, userEmail)) {
                    throw new AppException(ErrorCode.ACCESS_DENIED);
                }
            }
        }
    }

    private boolean parseWaitingRoomSetting(String settingsJson) {
        if (settingsJson == null || settingsJson.isBlank()) return true;
        try {
            JsonNode node = objectMapper.readTree(settingsJson);
            JsonNode waitingRoomNode = node.get("waitingRoom");
            if (waitingRoomNode != null && waitingRoomNode.isBoolean()) {
                return waitingRoomNode.asBoolean();
            }
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse meeting settings JSON, defaulting waitingRoom=true: {}", e.getMessage());
        }
        return true;
    }

    private String resolveDisplayName(String requestedName, String userId) {
        if (requestedName != null && !requestedName.isBlank()) return requestedName.trim();
        return "Participant";
    }

    private MeetingHistoryResponse toHistoryResponse(Meeting m, String userId) {
        boolean isOwner = userId.equals(m.getOwnerId());
        boolean isHost = userId.equals(m.getHostId()) || isOwner;
        return MeetingHistoryResponse.builder()
                .meetingCode(m.getMeetingCode()).title(m.getTitle())
                .startTime(m.getStartTime()).endTime(m.getEndTime())
                .status(m.getStatus().name()).isHost(isHost).isOwner(isOwner)
                .canViewRecordings(isOwner).canViewChatHistory(isOwner)
                .build();
    }

    private String formatDuration(Duration d) {
        long hours = d.toHours();
        long minutes = d.toMinutesPart();
        if (hours > 0) return hours + "h " + minutes + "m";
        return minutes + "m";
    }

    @Override
    public void startRecording(String userId, String meetingCode) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

        if (!userId.equals(meeting.getOwnerId())) {
            throw new AppException(ErrorCode.ONLY_OWNER);
        }

        RecordingResponse recordingResponse;
        try {
            // Gọi Media Service qua gRPC
            recordingResponse = mediaGrpcClient.startRecording(meetingCode, userId);
        } catch (AppException e) {
            throw e;  // Re-throw
        }

        // Broadcast STOMP event
        messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
                SystemEvent.builder()
                        .action("RECORDING_STARTED")
                        .egressId(recordingResponse.getEgressId())
                        .build());
    }

    @Override
    public void stopRecording(String userId, String meetingCode, String egressId) {
        Meeting meeting = meetingRepository.findByMeetingCode(meetingCode)
                .orElseThrow(() -> new AppException(ErrorCode.MEETING_NOT_FOUND));

        if (!userId.equals(meeting.getOwnerId())) {
            throw new AppException(ErrorCode.ONLY_OWNER);
        }

        mediaGrpcClient.stopRecording(egressId);

        messagingTemplate.convertAndSend("/topic/meeting/" + meetingCode,
                SystemEvent.builder()
                        .action("RECORDING_STOPPED")
                        .egressId(egressId)
                        .build());
    }
}
