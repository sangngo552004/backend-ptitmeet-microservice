package com.ptitmeet.meeting.repository;

import com.ptitmeet.meeting.entity.Meeting;
import com.ptitmeet.meeting.entity.MeetingFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingFeedbackRepository extends JpaRepository<MeetingFeedback, Long> {
    boolean existsByMeetingAndUserId(Meeting meeting, String userId);
}
