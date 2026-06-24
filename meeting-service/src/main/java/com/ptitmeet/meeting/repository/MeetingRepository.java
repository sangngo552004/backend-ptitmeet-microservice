package com.ptitmeet.meeting.repository;

import com.ptitmeet.meeting.entity.Meeting;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MeetingRepository extends JpaRepository<Meeting, String> {
    Optional<Meeting> findByMeetingCode(String meetingCode);
    List<Meeting> findByOwnerIdOrHostId(String ownerId, String hostId);
    boolean existsByMeetingCode(String meetingCode);

    // Phase 07: History — meetings mà user là participant
    @Query("""
        SELECT DISTINCT p.meeting FROM Participant p
        WHERE p.userId = :userId
        AND (:status = 'ALL' OR p.meeting.status = :statusEnum)
        ORDER BY p.meeting.createdAt DESC
        """)
    Page<Meeting> findMeetingHistoryByUserId(
            @Param("userId") String userId,
            @Param("status") String status,
            @Param("statusEnum") Meeting.MeetingStatus statusEnum,
            Pageable pageable);

    // Chỉ meetings mà user là host/owner
    @Query("""
        SELECT DISTINCT p.meeting FROM Participant p
        WHERE p.userId = :userId
        AND (p.meeting.ownerId = :userId OR p.meeting.hostId = :userId)
        AND (:status = 'ALL' OR p.meeting.status = :statusEnum)
        ORDER BY p.meeting.createdAt DESC
        """)
    Page<Meeting> findHostMeetingHistoryByUserId(
            @Param("userId") String userId,
            @Param("status") String status,
            @Param("statusEnum") Meeting.MeetingStatus statusEnum,
            Pageable pageable);

    // Chỉ meetings mà user là guest (không phải owner)
    @Query("""
        SELECT DISTINCT p.meeting FROM Participant p
        WHERE p.userId = :userId
        AND p.meeting.ownerId != :userId
        AND (:status = 'ALL' OR p.meeting.status = :statusEnum)
        ORDER BY p.meeting.createdAt DESC
        """)
    Page<Meeting> findGuestMeetingHistoryByUserId(
            @Param("userId") String userId,
            @Param("status") String status,
            @Param("statusEnum") Meeting.MeetingStatus statusEnum,
            Pageable pageable);

    // Up-next: meeting SCHEDULED gần nhất của owner
    Optional<Meeting> findFirstByOwnerIdAndStatusAndStartTimeAfterOrderByStartTimeAsc(
            String ownerId,
            Meeting.MeetingStatus status,
            LocalDateTime startTimeAfter);
}
