package com.pca.spring_backend.candidature.service.impl;

import com.pca.spring_backend.candidature.dto.CandidatureDto;
import com.pca.spring_backend.candidature.entity.Candidature;
import com.pca.spring_backend.candidature.repository.CandidatureRepository;
import com.pca.spring_backend.candidature.service.CandidatureService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CandidatureServiceImpl implements CandidatureService {

    private final CandidatureRepository repository;

    public CandidatureServiceImpl(CandidatureRepository repository) {
        this.repository = repository;
    }

    @Override
    public CandidatureDto create(CandidatureDto dto) {
        Candidature entity = Candidature.builder()
                .candidateName(dto.candidateName())
                .email(dto.email())
                .subject(dto.subject())
                .decision(dto.decision())
                .score(dto.score())
                .build();
        return toDto(repository.save(entity));
    }

    @Override
    public List<CandidatureDto> findRecent() {
        return repository.findTop10ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    public List<CandidatureDto> findAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    private CandidatureDto toDto(Candidature c) {
        return new CandidatureDto(
                c.getId(),
                c.getCandidateName(),
                c.getEmail(),
                c.getSubject(),
                c.getDecision(),
                c.getScore(),
                c.getCreatedAt()
        );
    }
}

