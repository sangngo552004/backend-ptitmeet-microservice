package com.ptitmeet.meeting.service;

import com.ptitmeet.meeting.dto.request.ApprovalRequest;
import com.ptitmeet.meeting.dto.request.CreateMeetingRequest;
import com.ptitmeet.meeting.dto.request.FeedbackRequest;
import com.ptitmeet.meeting.dto.request.JoinMeetingRequest;
import com.ptitmeet.meeting.dto.request.SystemMessage;
import com.ptitmeet.meeting.dto.response.ChatMessageResponse;
import com.ptitmeet.meeting.dto.response.JoinMeetingResponse;
import com.ptitmeet.meeting.dto.response.MeetingHistoryResponse;
import com.ptitmeet.meeting.dto.response.MeetingInfoResponse;
import com.ptitmeet.meeting.dto.response.MeetingResponse;
import com.ptitmeet.meeting.dto.response.MeetingSummaryResponse;
import com.ptitmeet.meeting.dto.response.ParticipantResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.Map;

public interface MeetingService {
    // Phase 04
    MeetingResponse createInstantMeeting(String userId, String userName);
    MeetingResponse scheduleMeeting(String userId, CreateMeetingRequest req);
    void cancelMeeting(String userId, String meetingCode);
    List<MeetingResponse> getMyMeetings(String userId);
    MeetingInfoResponse getMeetingInfo(String userId, String meetingCode);

    // Phase 05
    JoinMeetingResponse joinMeeting(String userId, String userEmail,
                                    String meetingCode, JoinMeetingRequest req,
                                    HttpServletRequest httpRequest);
    List<ParticipantResponse> getWaitingRoom(String userId, String meetingCode);

    // Phase 06
    void leaveMeeting(String userId, String meetingCode);
    void endForAll(String userId, String meetingCode);
    void approveParticipant(String hostUserId, String meetingCode, ApprovalRequest req);
    void handleSystemAction(String userId, String meetingCode, SystemMessage message);

    // Phase 07
    Page<MeetingHistoryResponse> getHistory(String userId, int page, int size, String role, String status);
    MeetingHistoryResponse getUpNext(String userId);
    MeetingSummaryResponse getSummary(String userId, String meetingCode);
    List<ChatMessageResponse> getChatHistory(String userId, String meetingCode);

    void startRecording(String userId, String meetingCode);
    void stopRecording(String userId, String meetingCode, String egressId);

    void submitFeedback(String userId, String meetingCode, FeedbackRequest req);
    String getSettings(String userId, String meetingCode);
    MeetingResponse updateSettings(String userId, String meetingCode, Map<String, Object> newSettings);
}
