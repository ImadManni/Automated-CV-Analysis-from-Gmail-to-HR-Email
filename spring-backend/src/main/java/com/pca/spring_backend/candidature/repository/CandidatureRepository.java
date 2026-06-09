package com.pca.spring_backend.candidature.repository;

import com.pca.spring_backend.candidature.entity.Candidature;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CandidatureRepository extends JpaRepository<Candidature, Long> {

    List<Candidature> findTop10ByOrderByCreatedAtDesc();
}

