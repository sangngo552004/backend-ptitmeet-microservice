package com.ptitmeet.media.repository;

import com.ptitmeet.media.entity.MeetingRecording;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MeetingRecordingRepository extends JpaRepository<MeetingRecording, Long> {
    Optional<MeetingRecording> findByEgressId(String egressId);
    List<MeetingRecording> findByOwnerIdOrderByCreatedAtDesc(String ownerId);
    Optional<MeetingRecording> findByRoomNameAndStatus(String roomName, MeetingRecording.RecordingStatus status);
}
