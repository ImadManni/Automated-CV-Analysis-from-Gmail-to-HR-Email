/**
 * Campagnes de recrutement et offres pour la page Campagnes / Offres.
 * - Campagnes PCA : Software/IA, Data & BI, Cloud/DevOps
 * - Chaque campagne a sa liste d'offres (titres, entreprises, lieux).
 */

// Aucun appel externe ici : uniquement des données mock pour tester le routage.

// Campagnes PCA (exemples de PFE / emploi par année)
const PCA_CAMPAIGNS = [
  {
    id: 'pca-sw',
    name: 'Stages PFE – 2026',
    code: 'PCA-SW',
    status: 'active',
    start_date: null,
    end_date: null,
  },
  {
    id: 'pca-data',
    name: 'Offres d’emploi – 2026',
    code: 'PCA-DATA',
    status: 'active',
    start_date: null,
    end_date: null,
  },
  {
    id: 'pca-cloud',
    name: 'Recrutements expérimentés – 2026',
    code: 'PCA-CLOUD',
    status: 'active',
    start_date: null,
    end_date: null,
  },
]

const OFFERS_BY_CAMPAIGN = {
  'pca-sw': [
    {
      id: 'pca-sw-1',
      title: 'Stage PFE – Full‑Stack Developer (JavaScript/React)',
      reference: 'PCA-SW-1',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: 'PCA Payment Center for Africa',
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/search?keywords=Stage%20PFE%20Full%20Stack%20Developer%20Casablanca',
    },
    {
      id: 'pca-sw-2',
      // Garder un intitulé "LinkedIn-like" mais sans données mock
      title: 'Senior React Developer',
      reference: 'PCA-SW-2',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: 'PCA Payment Center for Africa',
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/search?keywords=Senior%20React%20Developer%20Casablanca',
    },
  ],
  'pca-data': [
    {
      id: 'pca-data-1',
      title: 'Stage PFE – Data Analyst / BI (Power BI)',
      reference: 'PCA-DATA-1',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: 'PCA Payment Center for Africa',
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/search?keywords=Power%20BI%20Stage%20PFE%20Casablanca',
    },
    {
      id: 'pca-data-2',
      title: 'Offre d’emploi – BI Engineer (Power BI)',
      reference: 'PCA-DATA-2',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: 'PCA Payment Center for Africa',
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/search?keywords=BI%20Engineer%20Power%20BI',
    },
  ],
  'pca-cloud': [
    {
      id: 'pca-cloud-1',
      title: 'Offre d’emploi – DevOps Engineer (AWS/Docker)',
      reference: 'PCA-CLOUD-1',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: 'PCA Payment Center for Africa',
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/search?keywords=DevOps%20Engineer%20AWS%20Casablanca',
    },
    {
      id: 'pca-cloud-2',
      title: 'Stage PFE – Cloud Engineer (Azure/AWS)',
      reference: 'PCA-CLOUD-2',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: 'PCA Payment Center for Africa',
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/search?keywords=Cloud%20Engineer%20Stage%20PFE%20Casablanca',
    },
  ],
}

/**
 * Liste des campagnes de recrutement PCA (Software, Data, Cloud).
 */
export async function getAdzunaCampaigns() {
  return PCA_CAMPAIGNS.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    status: c.status,
    start_date: c.start_date,
    end_date: c.end_date,
    results_count: (OFFERS_BY_CAMPAIGN[c.id] || []).length,
  }))
}

/**
 * Offres pour une campagne donnée.
 */
export async function getAdzunaOffers(campaignId) {
  const key = String(campaignId)
  return OFFERS_BY_CAMPAIGN[key] || []
}
