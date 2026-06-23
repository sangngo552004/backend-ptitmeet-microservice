package com.ptitmeet.meeting.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "meeting_invitations")
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingInvitation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
    private String userId;  // Raw UUID, nullable

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
}
