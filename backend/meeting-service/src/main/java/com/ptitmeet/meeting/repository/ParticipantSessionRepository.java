package com.ptitmeet.meeting.repository;

import com.ptitmeet.meeting.entity.Participant;
import com.ptitmeet.meeting.entity.ParticipantSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParticipantSessionRepository extends JpaRepository<ParticipantSession, Long> {
    Optional<ParticipantSession> findTopByParticipantOrderByJoinedAtDesc(Participant participant);
    Optional<ParticipantSession> findByParticipantAndStatus(Participant participant, ParticipantSession.SessionStatus status);
    List<ParticipantSession> findByParticipant_Meeting_MeetingCodeAndStatus(
            String meetingCode, ParticipantSession.SessionStatus status);

    // Phase 06: leaveMeeting + endForAll
    long countByParticipant_Meeting_MeetingCodeAndStatus(
            String meetingCode, ParticipantSession.SessionStatus status);
    Optional<ParticipantSession> findFirstByParticipant_Meeting_MeetingCodeAndStatusAndParticipant_UserIdNot(
            String meetingCode, ParticipantSession.SessionStatus status, String excludeUserId);
    List<ParticipantSession> findAllByParticipant_Meeting_MeetingCodeAndStatus(
            String meetingCode, ParticipantSession.SessionStatus status);

    // Phase 07: Chat history access check
    boolean existsByParticipant_Meeting_MeetingCodeAndParticipant_UserIdAndStatus(
            String meetingCode, String userId, ParticipantSession.SessionStatus status);
}
