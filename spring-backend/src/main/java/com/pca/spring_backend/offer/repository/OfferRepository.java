package com.pca.spring_backend.offer.repository;

import com.pca.spring_backend.offer.entity.Offer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OfferRepository extends JpaRepository<Offer, Long> {

    List<Offer> findByCampaign_Id(Long campaignId);
}

