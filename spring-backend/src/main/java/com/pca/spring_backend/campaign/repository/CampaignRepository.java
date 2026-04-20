package com.pca.spring_backend.campaign.repository;

import com.pca.spring_backend.campaign.entity.Campaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {

    Optional<Campaign> findByCode(String code);
}

