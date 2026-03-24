package com.pca.spring_backend.offer.dto;

import java.time.Instant;

public record OfferDto(
        Long id,
        Long campaignId,
        String title,
        String reference,
        String description,
        String location,
        String status,
        Instant createdAt,
        Instant updatedAt
) {}

