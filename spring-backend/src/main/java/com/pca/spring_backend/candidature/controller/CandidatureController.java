package com.pca.spring_backend.candidature.controller;

import com.pca.spring_backend.candidature.dto.CandidatureDto;
import com.pca.spring_backend.candidature.service.CandidatureService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/candidatures")
public class CandidatureController {

    private final CandidatureService service;

    public CandidatureController(CandidatureService service) {
        this.service = service;
    }

    @GetMapping
    public List<CandidatureDto> findAll() {
        return service.findAll();
    }

    @GetMapping("/recent")
    public List<CandidatureDto> recent() {
        return service.findRecent();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CandidatureDto create(@RequestBody CandidatureDto dto) {
        return service.create(dto);
    }
}

