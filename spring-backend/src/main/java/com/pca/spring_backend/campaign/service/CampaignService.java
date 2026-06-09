package com.pca.spring_backend.campaign.service;

import com.pca.spring_backend.campaign.dto.CampaignDto;

import java.util.List;

public interface CampaignService {

    CampaignDto create(CampaignDto dto);

    List<CampaignDto> findAll();

    CampaignDto findById(Long id);
}

