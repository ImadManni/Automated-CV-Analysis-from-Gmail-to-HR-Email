/**
 * Business Units — campagne « Payment center for Africa » (PCA).
 * Les codes sont stockés en base (`business_unit`) ; les libellés servent à l’UI.
 */
export const PCA_PAYMENT_CENTER_CAMPAIGN_LABEL =
  'Payment center for Africa (Processing Monétique, Solutions Digitales, Gestion des Cartes, Sécurité et Risques, Intégration IT)'

export const PCA_PAYMENT_CENTER_AF_BU = [
  { code: 'PROCESSING_MONETIQUE', label: 'Processing Monétique' },
  { code: 'SOLUTIONS_DIGITALES', label: 'Solutions Digitales' },
  { code: 'GESTION_CARTES', label: 'Gestion des Cartes' },
  { code: 'SECURITE_RISQUES', label: 'Sécurité et Risques' },
  { code: 'INTEGRATION_IT', label: 'Intégration IT' },
] as const

export type PcaPaymentCenterBuCode = (typeof PCA_PAYMENT_CENTER_AF_BU)[number]['code']

const BU_LABEL = new Map<string, string>(
  PCA_PAYMENT_CENTER_AF_BU.map((x) => [x.code, x.label]),
)

export function buLabel(code: string | undefined | null): string {
  if (!code?.trim()) return ''
  return BU_LABEL.get(code.trim()) || code
}
