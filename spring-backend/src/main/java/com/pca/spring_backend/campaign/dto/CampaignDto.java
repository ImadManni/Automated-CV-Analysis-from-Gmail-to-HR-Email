package com.pca.spring_backend.campaign.dto;

import java.time.Instant;

public record CampaignDto(
        Long id,
        String name,
        String code,
        String status,
        Instant startDate,
        Instant endDate
) {}

