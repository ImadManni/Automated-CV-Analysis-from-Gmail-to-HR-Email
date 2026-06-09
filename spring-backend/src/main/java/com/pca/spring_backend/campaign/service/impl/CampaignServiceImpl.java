package com.pca.spring_backend.campaign.service.impl;

import com.pca.spring_backend.campaign.dto.CampaignDto;
import com.pca.spring_backend.campaign.entity.Campaign;
import com.pca.spring_backend.campaign.repository.CampaignRepository;
import com.pca.spring_backend.campaign.service.CampaignService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CampaignServiceImpl implements CampaignService {

    private final CampaignRepository repository;

    public CampaignServiceImpl(CampaignRepository repository) {
        this.repository = repository;
    }

    @Override
    public CampaignDto create(CampaignDto dto) {
        Campaign entity = Campaign.builder()
                .name(dto.name())
                .code(dto.code())
                .status(dto.status())
                .startDate(dto.startDate())
                .endDate(dto.endDate())
                .build();
        return toDto(repository.save(entity));
    }

    @Override
    public List<CampaignDto> findAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public CampaignDto findById(Long id) {
        return repository.findById(id).map(this::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found: " + id));
    }

    private CampaignDto toDto(Campaign c) {
        return new CampaignDto(
                c.getId(),
                c.getName(),
                c.getCode(),
                c.getStatus(),
                c.getStartDate(),
                c.getEndDate()
        );
    }
}

