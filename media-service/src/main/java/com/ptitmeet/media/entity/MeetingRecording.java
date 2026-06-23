package com.ptitmeet.media.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "meeting_recordings")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingRecording {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_name", nullable = false, length = 100)
    private String roomName;          // = meeting_code

    @Column(name = "egress_id", unique = true, nullable = false)
    private String egressId;

    @Column(name = "meeting_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String meetingId;         // Raw UUID — NO FK

    @Column(name = "owner_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String ownerId;           // Raw UUID — NO FK

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private RecordingStatus status = RecordingStatus.RECORDING;

    @Column(name = "file_url", columnDefinition = "TEXT")
    private String fileUrl;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public enum RecordingStatus { RECORDING, COMPLETED, FAILED }
}
