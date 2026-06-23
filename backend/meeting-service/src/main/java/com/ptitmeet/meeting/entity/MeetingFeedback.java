package com.ptitmeet.meeting.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "meeting_feedbacks",
    uniqueConstraints = @UniqueConstraint(columnNames = {"meeting_id", "user_id"}))
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MeetingFeedback {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    private Meeting meeting;

    @Column(name = "user_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private String userId;  // Raw UUID

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
}
