package com.ptitmeet.meeting.worker;

import com.ptitmeet.meeting.entity.OutboxEvent;
import com.ptitmeet.meeting.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxWorker {

    private final OutboxEventRepository outboxEventRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    /**
     * Polling outbox table mỗi 5 giây, gửi tối đa 20 events PENDING lên Kafka.
     * Pattern: Transactional Outbox — đảm bảo at-least-once delivery.
     */
    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void processOutboxEvents() {
        List<OutboxEvent> pendingEvents = outboxEventRepository
                .findTop20ByStatusOrderByCreatedAtAsc(OutboxEvent.OutboxStatus.PENDING);

        if (pendingEvents.isEmpty()) return;

        log.debug("Processing {} outbox events", pendingEvents.size());

        for (OutboxEvent event : pendingEvents) {
            try {
                kafkaTemplate.send("meeting-events", event.getAggregateId(), event.getPayload());
                event.setStatus(OutboxEvent.OutboxStatus.SENT);
                event.setProcessedAt(LocalDateTime.now());
                log.info("Outbox event {} sent: type={}", event.getId(), event.getEventType());
            } catch (Exception e) {
                log.error("Failed to publish outbox event {}: {}", event.getId(), e.getMessage());
                event.setStatus(OutboxEvent.OutboxStatus.FAILED);
            }
            outboxEventRepository.save(event);
        }
    }
}
