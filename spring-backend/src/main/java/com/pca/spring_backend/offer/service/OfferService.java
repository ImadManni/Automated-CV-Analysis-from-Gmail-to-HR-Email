package com.pca.spring_backend.offer.service;

import com.pca.spring_backend.offer.dto.OfferDto;

import java.util.List;

public interface OfferService {

    OfferDto createForCampaign(Long campaignId, OfferDto dto);

    List<OfferDto> findByCampaign(Long campaignId);

    OfferDto findById(Long id);
}

