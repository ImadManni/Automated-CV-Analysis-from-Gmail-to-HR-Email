package com.pca.spring_backend.candidature.service;

import com.pca.spring_backend.candidature.dto.CandidatureDto;

import java.util.List;

public interface CandidatureService {

    CandidatureDto create(CandidatureDto dto);

    List<CandidatureDto> findRecent();

    List<CandidatureDto> findAll();
}

