package com.ptitmeet.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "aws.s3")
@Data
public class S3Properties {
    private String bucket;
    private String region;
    private String accessKey;
    private String secretKey;
}
