package com.ptitmeet.meeting.controller;

import com.ptitmeet.common.dto.ApiResponse;
import com.ptitmeet.meeting.dto.request.ApprovalRequest;
import com.ptitmeet.meeting.dto.request.CreateMeetingRequest;
import com.ptitmeet.meeting.dto.request.FeedbackRequest;
import com.ptitmeet.meeting.dto.request.JoinMeetingRequest;
import com.ptitmeet.meeting.dto.response.ChatMessageResponse;
import com.ptitmeet.meeting.dto.response.JoinMeetingResponse;
import com.ptitmeet.meeting.dto.response.MeetingHistoryResponse;
import com.ptitmeet.meeting.dto.response.MeetingInfoResponse;
import com.ptitmeet.meeting.dto.response.MeetingResponse;
import com.ptitmeet.meeting.dto.response.MeetingSummaryResponse;
import com.ptitmeet.meeting.dto.response.ParticipantResponse;
import com.ptitmeet.meeting.service.MeetingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;

    private String getUserId(HttpServletRequest request) {
        return request.getHeader("X-User-Id");
    }

    private String getUserName(HttpServletRequest request) {
        return request.getHeader("X-User-Name");
    }

    private String getUserEmail(HttpServletRequest request) {
        return request.getHeader("X-User-Email");
    }

    // ── Phase 04 ─────────────────────────────────────────────────────────────

    @PostMapping("/instant")
    public ResponseEntity<ApiResponse<MeetingResponse>> createInstant(
            HttpServletRequest request,
            @RequestBody(required = false) CreateMeetingRequest req) {
        MeetingResponse response = meetingService.createInstantMeeting(getUserId(request), getUserName(request));
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/schedule")
    public ResponseEntity<ApiResponse<MeetingResponse>> schedule(
            HttpServletRequest request,
            @Valid @RequestBody CreateMeetingRequest req) {
        MeetingResponse response = meetingService.scheduleMeeting(getUserId(request), req);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my-meetings")
    public ResponseEntity<ApiResponse<List<MeetingResponse>>> getMyMeetings(HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.getMyMeetings(getUserId(request))));
    }

    @GetMapping("/{code}/info")
    public ResponseEntity<ApiResponse<MeetingInfoResponse>> getInfo(
            @PathVariable String code, HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.getMeetingInfo(getUserId(request), code)));
    }

    @DeleteMapping("/{code}")
    public ResponseEntity<ApiResponse<Void>> cancel(
            @PathVariable String code, HttpServletRequest request) {
        meetingService.cancelMeeting(getUserId(request), code);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Phase 05 ─────────────────────────────────────────────────────────────

    @PostMapping("/{code}/join")
    public ResponseEntity<ApiResponse<JoinMeetingResponse>> joinMeeting(
            @PathVariable String code,
            @RequestBody(required = false) JoinMeetingRequest req,
            HttpServletRequest request) {
        if (req == null) req = new JoinMeetingRequest();
        return ResponseEntity.ok(ApiResponse.success(
                meetingService.joinMeeting(getUserId(request), getUserEmail(request), code, req, request)));
    }

    @GetMapping("/{code}/waiting-room")
    public ResponseEntity<ApiResponse<List<ParticipantResponse>>> getWaitingRoom(
            @PathVariable String code, HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.getWaitingRoom(getUserId(request), code)));
    }

    // ── Phase 06 ─────────────────────────────────────────────────────────────

    @PostMapping("/{code}/leave")
    public ResponseEntity<ApiResponse<Void>> leave(
            @PathVariable String code, HttpServletRequest request) {
        meetingService.leaveMeeting(getUserId(request), code);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{code}/end")
    public ResponseEntity<ApiResponse<Void>> endForAll(
            @PathVariable String code, HttpServletRequest request) {
        meetingService.endForAll(getUserId(request), code);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{code}/approval")
    public ResponseEntity<ApiResponse<Void>> approveParticipant(
            @PathVariable String code,
            @Valid @RequestBody ApprovalRequest approvalRequest,
            HttpServletRequest request) {
        meetingService.approveParticipant(getUserId(request), code, approvalRequest);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Phase 07 ─────────────────────────────────────────────────────────────

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<Page<MeetingHistoryResponse>>> getHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "6") int size,
            @RequestParam(defaultValue = "ALL") String role,
            @RequestParam(defaultValue = "ALL") String status,
            HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                meetingService.getHistory(getUserId(request), page, size, role, status)));
    }

    @GetMapping("/up-next")
    public ResponseEntity<ApiResponse<MeetingHistoryResponse>> getUpNext(HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.getUpNext(getUserId(request))));
    }

    @GetMapping("/{code}/summary")
    public ResponseEntity<ApiResponse<MeetingSummaryResponse>> getSummary(
            @PathVariable String code,
            @RequestParam(defaultValue = "LEAVE") String action,
            HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.getSummary(getUserId(request), code)));
    }

    @GetMapping("/{code}/chat/history")
    public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getChatHistory(
            @PathVariable String code, HttpServletRequest req) {
        return ResponseEntity.ok(ApiResponse.success(
                meetingService.getChatHistory(req.getHeader("X-User-Id"), code)));
    }

    @PostMapping("/{code}/recording/start")
    public ResponseEntity<ApiResponse<Void>> startRecording(
            @PathVariable String code, HttpServletRequest req) {
        meetingService.startRecording(req.getHeader("X-User-Id"), code);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{code}/recording/stop")
    public ResponseEntity<ApiResponse<Void>> stopRecording(
            @PathVariable String code,
            @RequestParam String egressId,
            HttpServletRequest req) {
        meetingService.stopRecording(req.getHeader("X-User-Id"), code, egressId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{code}/feedback")
    public ResponseEntity<ApiResponse<Void>> feedback(
            @PathVariable String code,
            @Valid @RequestBody FeedbackRequest req,
            HttpServletRequest request) {
        meetingService.submitFeedback(getUserId(request), code, req);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/{code}/settings")
    public ResponseEntity<ApiResponse<String>> getSettings(
            @PathVariable String code, HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(meetingService.getSettings(getUserId(request), code)));
    }

    @PutMapping("/{code}/settings")
    public ResponseEntity<ApiResponse<MeetingResponse>> updateSettings(
            @PathVariable String code,
            @RequestBody Map<String, Object> settings,
            HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                meetingService.updateSettings(getUserId(request), code, settings)));
    }
}
