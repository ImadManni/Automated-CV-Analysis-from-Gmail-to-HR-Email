import type { Candidature } from '@/store/candidaturesSlice'
import type { HrKpiPayload } from '@/api/hrKpi'
import type { MatrixInterview } from '@/components/dashboard/InterviewMatrixTable'

export const demoCandidatures: Candidature[] = [
  {
    id: '193',
    candidateName: 'Imad Manni',
    email: 'hydragaming595@gmail.com',
    subject: 'Stage PFE - Full-Stack Developer',
    date: '2026-04-08T09:36:00.000Z',
    decision: 'À REVOIR',
    score: 50,
    skills: 'Java, JavaScript, TypeScript, React, Spring Boot, SQL',
    rawSummary: 'Candidat fin de cycle avec profil full-stack et intérêt IA.',
    offerTitle: 'Stage PFE - Full-Stack Developer (JavaScript/React)',
  },
  {
    id: '194',
    candidateName: 'Abdelmonaim Ahdoud',
    email: 'abdelmonaim@example.com',
    subject: 'Offre d’emploi - DevOps Engineer',
    date: '2026-04-07T08:10:00.000Z',
    decision: 'ACCEPTÉE',
    score: 82,
    skills: 'AWS, Docker, Terraform, Linux',
    offerTitle: 'Offre d’emploi - DevOps Engineer (AWS/Docker)',
  },
  {
    id: '195',
    candidateName: 'Youness Arroubi',
    email: 'youness@example.com',
    subject: 'Stage PFE - Data Analyst / BI',
    date: '2026-04-06T12:20:00.000Z',
    decision: 'REFUSÉE',
    score: 43,
    skills: 'Power BI, SQL, Excel',
    offerTitle: 'Stage PFE - Data Analyst / BI (Power BI)',
  },
]

export const demoInterviews: MatrixInterview[] = [
  {
    id: 9001,
    candidatureId: 194,
    scheduledAt: '2026-04-10T14:30:00.000Z',
    mode: 'VISIO',
    location: 'jitsi / room-1',
    status: 'REALISE',
    notesRh: 'ENTRETIEN RH',
    interviewType: 'ENTRETIEN RH',
  },
  {
    id: 9002,
    candidatureId: 194,
    scheduledAt: '2026-04-12T14:30:00.000Z',
    mode: 'VISIO',
    location: 'jitsi / room-2',
    status: 'REALISE',
    notesRh: 'ENTRETIEN TECHNIQUE',
    interviewType: 'ENTRETIEN TECHNIQUE',
  },
  {
    id: 9003,
    candidatureId: 194,
    scheduledAt: '2026-04-14T14:31:00.000Z',
    mode: 'VISIO',
    location: 'jitsi / room-3',
    status: 'REALISE',
    notesRh: 'ENTRETIEN DIRECTEUR',
    interviewType: 'ENTRETIEN DIRECTEUR',
  },
  {
    id: 9004,
    candidatureId: 195,
    scheduledAt: '2026-04-26T15:08:00.000Z',
    mode: 'VISIO',
    location: 'meet / room-5',
    status: 'ANNULE',
    notesRh: 'ENTRETIEN TECHNIQUE',
    interviewType: 'ENTRETIEN TECHNIQUE',
  },
]

export const demoHrKpi: HrKpiPayload = {
  totalApplicants: 201,
  selectedForInterview: 25,
  retainedWithInterview: 12,
  candidaturesWithInterviewScheduled: 25,
  candidaturesWithTwoPlusInterviews: 10,
  avgReceptionToLastInterviewMs: 352800000,
  medianSpanFirstToLastMs: 475200000,
  byOffer: [
    { offerLabel: 'Sans offre cible', applicationsCount: 129, selectedForInterviewCount: 10, retainedCount: 29, retainedWithInterviewCount: 7 },
    { offerLabel: 'Stage PFE - Full-Stack Developer (JavaScript/React)', applicationsCount: 34, selectedForInterviewCount: 5, retainedCount: 8, retainedWithInterviewCount: 2 },
    { offerLabel: 'Stage PFE - Data Analyst / BI (Power BI)', applicationsCount: 9, selectedForInterviewCount: 4, retainedCount: 3, retainedWithInterviewCount: 1 },
    { offerLabel: 'Senior React Developer', applicationsCount: 8, selectedForInterviewCount: 2, retainedCount: 2, retainedWithInterviewCount: 1 },
    { offerLabel: 'Offre d’emploi - BI Engineer (Power BI)', applicationsCount: 8, selectedForInterviewCount: 0, retainedCount: 2, retainedWithInterviewCount: 0 },
    { offerLabel: 'Stage PFE - Cloud Engineer (Azure/AWS)', applicationsCount: 6, selectedForInterviewCount: 3, retainedCount: 0, retainedWithInterviewCount: 0 },
    { offerLabel: 'Offre d’emploi - DevOps Engineer (AWS/Docker)', applicationsCount: 4, selectedForInterviewCount: 1, retainedCount: 1, retainedWithInterviewCount: 1 },
  ],
}

export const demoCampaigns = [
  { id: 'PCA-SW', name: 'Stages PFE - 2026', code: 'PCA-SW', status: 'active', results_count: 2 },
  { id: 'PCA-DATA', name: 'Data & BI - 2026', code: 'PCA-DATA', status: 'active', results_count: 2 },
  { id: 'PCA-CLOUD', name: 'Cloud / DevOps - 2026', code: 'PCA-CLOUD', status: 'active', results_count: 2 },
]

export const demoCampaignOffers: Record<string, Array<{ id: string; title: string; company: string; location: string; redirect_url: string | null }>> = {
  'PCA-SW': [
    { id: 'SW-1', title: 'Stage PFE - Full-Stack Developer (JavaScript/React)', company: 'PCA', location: 'Casablanca', redirect_url: null },
    { id: 'SW-2', title: 'Senior React Developer', company: 'PCA', location: 'Casablanca', redirect_url: null },
  ],
  'PCA-DATA': [
    { id: 'DT-1', title: 'Stage PFE - Data Analyst / BI (Power BI)', company: 'PCA', location: 'Casablanca', redirect_url: null },
    { id: 'DT-2', title: 'Offre d’emploi - BI Engineer (Power BI)', company: 'PCA', location: 'Casablanca', redirect_url: null },
  ],
  'PCA-CLOUD': [
    { id: 'CL-1', title: 'Stage PFE - Cloud Engineer (Azure/AWS)', company: 'PCA', location: 'Casablanca', redirect_url: null },
    { id: 'CL-2', title: 'Offre d’emploi - DevOps Engineer (AWS/Docker)', company: 'PCA', location: 'Casablanca', redirect_url: null },
  ],
}
