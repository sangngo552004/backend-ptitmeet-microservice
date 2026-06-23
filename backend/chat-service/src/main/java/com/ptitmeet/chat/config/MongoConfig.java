package com.ptitmeet.chat.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;

@Configuration
@RequiredArgsConstructor
public class MongoConfig {

    private final MongoTemplate mongoTemplate;

    /**
     * Tạo compound index trên meeting_code + timestamp cho hiệu suất query lịch sử chat.
     * Chạy khi application khởi động.
     */
    @PostConstruct
    public void createIndexes() {
        IndexOperations indexOps = mongoTemplate.indexOps("meeting_chats");

        // Compound index: tìm kiếm theo meeting_code, sort theo timestamp
        indexOps.ensureIndex(new CompoundIndexDefinition(
                new Document("meeting_code", 1).append("timestamp", 1)));

        // Index cho sender_id
        indexOps.ensureIndex(new Index().on("sender_id", Sort.Direction.ASC));
    }
}
