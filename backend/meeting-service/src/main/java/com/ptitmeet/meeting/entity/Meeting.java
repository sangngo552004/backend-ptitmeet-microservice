package com.ptitmeet.meeting.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "meetings")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class Meeting {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "meeting_id", columnDefinition = "VARCHAR(36)")
    private String meetingId;

    @Column(name = "host_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String hostId;

    @Column(name = "owner_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String ownerId;

    @Column(name = "meeting_code", unique = true, nullable = false, length = 20)
    private String meetingCode;

    @Column(name = "title", length = 255)
    private String title;

    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "is_instant", nullable = false)
    @Builder.Default
    private Boolean isInstant = false;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_type", nullable = false)
    @Builder.Default
    private AccessType accessType = AccessType.OPEN;

    @Column(name = "allowed_domain", length = 255)
    private String allowedDomain;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private MeetingStatus status = MeetingStatus.SCHEDULED;

    @Column(name = "settings", columnDefinition = "TEXT")
    private String settings; // JSON string

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum AccessType { OPEN, TRUSTED, RESTRICTED }
    public enum MeetingStatus { SCHEDULED, ACTIVE, FINISHED, CANCELED }
}
