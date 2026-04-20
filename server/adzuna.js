/**
 * Campagnes PCA + offres affichées (page Campagnes / catalogue n8n).
 * Titres et liens : alignés sur les fiches LinkedIn « Payment Center For Africa - PCA »
 * (Casablanca). Les URLs /jobs/view/… sont des exemples vérifiables ; les autres pointent
 * vers une recherche LinkedIn ciblée PCA + titre (les offres changent dans le temps).
 *
 * Page entreprise (toutes les offres) : https://www.linkedin.com/company/payment-center-for-africa---pca/jobs/
 */

const PCA_COMPANY = 'Payment Center For Africa - PCA'

/** ID entreprise LinkedIn (filtre « f_C ») — uniquement les offres publiées par PCA. */
const PCA_LINKEDIN_COMPANY_NUMERIC_ID = '10432840'

/** Liste officielle des offres publiées par PCA sur LinkedIn (à mettre à jour si besoin). */
const PCA_LINKEDIN_COMPANY_JOBS =
  'https://www.linkedin.com/company/payment-center-for-africa---pca/jobs/'

/**
 * Routing safe pour les offres sans URL exacte /jobs/view/<id>:
 * on redirige vers la page jobs officielle PCA au lieu d'une recherche keywords
 * (la recherche peut ouvrir un autre poste que celui cliqué).
 */
function pcaLinkedInSearch(keywords) {
  const _k = String(keywords || '').trim()
  return PCA_LINKEDIN_COMPANY_JOBS
}

// Campagnes PCA (regroupement métier côté plateforme ; les titres ci-dessous restent ceux de LinkedIn)
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
  // Offres LinkedIn PCA visibles sur la recherche entreprise / écrans projet (Ingénierie, QA, design)
  'pca-sw': [
    {
      id: 'pca-sw-1',
      title: 'Ingénieur de Développement Mobile (Spring boot / React Native)',
      reference: 'PCA-LI-4400543122',
      status: 'active',
      location: 'Casablanca Metropolitan Area (On-site)',
      company: PCA_COMPANY,
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/view/4400543122/',
    },
    {
      id: 'pca-sw-2',
      title: 'UX/UI Designer',
      reference: 'PCA-LI-4083438439',
      status: 'active',
      location: 'Casablanca Metropolitan Area (On-site)',
      company: PCA_COMPANY,
      created: null,
      redirect_url: 'https://www.linkedin.com/jobs/view/4083438439/',
    },
    {
      id: 'pca-sw-3',
      title: 'Ingénieur de Développement Full Stack Senior (Java / Spring / React.js)',
      reference: 'PCA-LI-SEARCH-FS',
      status: 'active',
      location: 'Casablanca Metropolitan Area (On-site)',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Ingénieur Full Stack Senior Java Spring React'),
    },
    {
      id: 'pca-sw-4',
      title: 'Ingénieur Test et Validation (QA)',
      reference: 'PCA-LI-SEARCH-QA',
      status: 'active',
      location: 'Casablanca Metropolitan Area (On-site)',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Ingénieur Test et Validation QA'),
    },
    {
      id: 'pca-sw-5',
      title: 'Responsable Test & Validation',
      reference: 'PCA-LI-SEARCH-RTV',
      status: 'active',
      location: 'Casablanca Metropolitan Area (On-site)',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Responsable Test Validation'),
    },
  ],
  // Piste data / gouvernance (recherche ciblée PCA ; ajuster les titres quand une fiche /jobs/view/ est disponible)
  'pca-data': [
    {
      id: 'pca-data-1',
      title: 'Stage PFE – Data Analyst / BI (Power BI)',
      reference: 'PCA-DATA-1',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Data Analyst BI Power BI'),
    },
    {
      id: 'pca-data-2',
      title: 'Stage PFE – Data Engineer (Python / SQL / Airflow)',
      reference: 'PCA-DATA-2',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Data Engineer Python SQL'),
    },
    {
      id: 'pca-data-3',
      title: 'Stage PFE – AI/ML Engineer (NLP & Scoring)',
      reference: 'PCA-DATA-3',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Machine Learning NLP'),
    },
    {
      id: 'pca-data-4',
      title: 'Stage PFE – Data Governance & Reporting (MIAGE)',
      reference: 'PCA-DATA-4',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Data Governance Reporting MIAGE'),
    },
  ],
  'pca-cloud': [
    {
      id: 'pca-cloud-1',
      title: 'Stage PFE – Cloud Engineer (Azure / AWS)',
      reference: 'PCA-CLOUD-1',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('Cloud Engineer Azure AWS'),
    },
    {
      id: 'pca-cloud-2',
      title: 'Stage PFE – DevOps & CI/CD (Docker / Kubernetes)',
      reference: 'PCA-CLOUD-2',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('DevOps Kubernetes Docker'),
    },
    {
      id: 'pca-cloud-3',
      title: 'Stage PFE – Payment Integration Engineer (API Monétique)',
      reference: 'PCA-CLOUD-3',
      status: 'active',
      location: 'Casablanca / Hybride',
      company: PCA_COMPANY,
      created: null,
      redirect_url: pcaLinkedInSearch('API Integration Payment'),
    },
  ],
}

export const PCA_LINKEDIN_JOBS_URL = PCA_LINKEDIN_COMPANY_JOBS
export const PCA_LINKEDIN_COMPANY_ID = PCA_LINKEDIN_COMPANY_NUMERIC_ID

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
