package com.ptitmeet.meeting.repository;

import com.ptitmeet.meeting.entity.Meeting;
import com.ptitmeet.meeting.entity.MeetingInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingInvitationRepository extends JpaRepository<MeetingInvitation, Long> {
    boolean existsByMeetingAndEmail(Meeting meeting, String email);
}
