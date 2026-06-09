package com.pca.spring_backend.candidature.dto;

import java.time.Instant;

public record CandidatureDto(
        Long id,
        String candidateName,
        String email,
        String subject,
        String decision,
        Integer score,
        Instant createdAt
) {}

