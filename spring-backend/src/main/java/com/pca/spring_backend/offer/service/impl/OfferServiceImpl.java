package com.pca.spring_backend.offer.service.impl;

import com.pca.spring_backend.campaign.entity.Campaign;
import com.pca.spring_backend.campaign.repository.CampaignRepository;
import com.pca.spring_backend.offer.dto.OfferDto;
import com.pca.spring_backend.offer.entity.Offer;
import com.pca.spring_backend.offer.repository.OfferRepository;
import com.pca.spring_backend.offer.service.OfferService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OfferServiceImpl implements OfferService {

    private final OfferRepository offerRepository;
    private final CampaignRepository campaignRepository;

    public OfferServiceImpl(OfferRepository offerRepository, CampaignRepository campaignRepository) {
        this.offerRepository = offerRepository;
        this.campaignRepository = campaignRepository;
    }

    @Override
    public OfferDto createForCampaign(Long campaignId, OfferDto dto) {
        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new IllegalArgumentException("Campaign not found: " + campaignId));

        Offer offer = Offer.builder()
                .campaign(campaign)
                .title(dto.title())
                .reference(dto.reference())
                .description(dto.description())
                .location(dto.location())
                .status(dto.status())
                .build();

        return toDto(offerRepository.save(offer));
    }

    @Override
    public List<OfferDto> findByCampaign(Long campaignId) {
        return offerRepository.findByCampaign_Id(campaignId).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    public OfferDto findById(Long id) {
        return offerRepository.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Offer not found: " + id));
    }

    private OfferDto toDto(Offer o) {
        return new OfferDto(
                o.getId(),
                o.getCampaign() != null ? o.getCampaign().getId() : null,
                o.getTitle(),
                o.getReference(),
                o.getDescription(),
                o.getLocation(),
                o.getStatus(),
                o.getCreatedAt(),
                o.getUpdatedAt()
        );
    }
}

