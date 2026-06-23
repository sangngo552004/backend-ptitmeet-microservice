package com.ptitmeet.meeting.repository;

import com.ptitmeet.meeting.entity.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    List<OutboxEvent> findTop20ByStatusOrderByCreatedAtAsc(OutboxEvent.OutboxStatus status);
}
