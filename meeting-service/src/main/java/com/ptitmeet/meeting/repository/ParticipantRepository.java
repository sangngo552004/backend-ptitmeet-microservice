package com.ptitmeet.meeting.repository;

import com.ptitmeet.meeting.entity.Meeting;
import com.ptitmeet.meeting.entity.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, String> {
    Optional<Participant> findByMeeting_MeetingIdAndUserId(String meetingId, String userId);
    Optional<Participant> findByMeetingAndUserId(Meeting meeting, String userId);
    List<Participant> findByMeetingAndApprovalStatus(Meeting meeting, Participant.ApprovalStatus approvalStatus);

    // Phase 07: Summary
    @Query("SELECT COUNT(DISTINCT p.userId) FROM Participant p WHERE p.meeting = :meeting")
    long countDistinctUserIdByMeeting(@Param("meeting") Meeting meeting);
}
