package com.ptitmeet.media.controller;

import com.ptitmeet.common.dto.ApiResponse;
import com.ptitmeet.media.dto.response.RecordingResponse;
import com.ptitmeet.media.service.RecordingService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/livekit")
@RequiredArgsConstructor
public class RecordingController {

    private final RecordingService recordingService;

    @PostMapping("/recordings/start")
    public ResponseEntity<ApiResponse<RecordingResponse>> startRecording(
            @RequestParam String meetingCode,
            HttpServletRequest request) {
        String ownerId = request.getHeader("X-User-Id");
        return ResponseEntity.ok(ApiResponse.success(
                recordingService.startRecording(ownerId, meetingCode)));
    }

    @PostMapping("/recordings/stop")
    public ResponseEntity<ApiResponse<Void>> stopRecording(
            @RequestParam String egressId) {
        recordingService.stopRecording(egressId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/recordings/my")
    public ResponseEntity<ApiResponse<List<RecordingResponse>>> getMyRecordings(
            HttpServletRequest request) {
        String ownerId = request.getHeader("X-User-Id");
        return ResponseEntity.ok(ApiResponse.success(
                recordingService.getMyRecordings(ownerId)));
    }

    // Compensating transaction endpoint (internal call from Meeting Service)
    @DeleteMapping("/recordings/{egressId}")
    public ResponseEntity<ApiResponse<Void>> compensate(
            @PathVariable String egressId) {
        recordingService.compensateRecording(egressId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
