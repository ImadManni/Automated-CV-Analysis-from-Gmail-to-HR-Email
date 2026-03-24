package com.pca.spring_backend.offer.controller;

import com.pca.spring_backend.offer.dto.OfferDto;
import com.pca.spring_backend.offer.service.OfferService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class OfferController {

    private final OfferService service;

    public OfferController(OfferService service) {
        this.service = service;
    }

    @GetMapping("/campaigns/{campaignId}/offers")
    public List<OfferDto> findByCampaign(@PathVariable Long campaignId) {
        return service.findByCampaign(campaignId);
    }

    @GetMapping("/offers/{id}")
    public OfferDto findById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping("/campaigns/{campaignId}/offers")
    @ResponseStatus(HttpStatus.CREATED)
    public OfferDto createForCampaign(@PathVariable Long campaignId, @RequestBody OfferDto dto) {
        return service.createForCampaign(campaignId, dto);
    }
}

