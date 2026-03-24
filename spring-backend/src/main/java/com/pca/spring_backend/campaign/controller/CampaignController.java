package com.pca.spring_backend.campaign.controller;

import com.pca.spring_backend.campaign.dto.CampaignDto;
import com.pca.spring_backend.campaign.service.CampaignService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/campaigns")
public class CampaignController {

    private final CampaignService service;

    public CampaignController(CampaignService service) {
        this.service = service;
    }

    @GetMapping
    public List<CampaignDto> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public CampaignDto findById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignDto create(@RequestBody CampaignDto dto) {
        return service.create(dto);
    }
}

