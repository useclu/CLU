export const CLU_COMMERCIAL = {
  productId: 'CLU_METROPOLE',
  productName: 'CLU Métropole',
  priceEuro: 4.99,
  apiBase: typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? 'http://localhost:8787'
    : 'https://api.useclu.pro',
  preview: {
    startIso: '2026-09-21T12:00:00+02:00',
    endIso: '2026-09-28T12:00:00+02:00',
    zoneLabel: 'heure de Paris',
  },
  legal: {
    version: '1.0',
    effectiveDate: '21 septembre 2026',

    // Identité personnelle volontairement retirée de la version actuelle.
    // Ces champs restent vides tant qu'aucune identité d'éditeur ne doit être publiée dans le jeu.
    sellerName: '',
    tradeName: 'CLU',
    address: '',
    email: '',
    phone: '',
    registration: '',
    vat: '',
    mediatorName: '',
    mediatorAddress: '',
    mediatorUrl: '',

    hostName: 'GitHub Pages / GitHub',
    hostAddress: 'GitHub B.V., Prins Bernhardplein 200, 1097 JB Amsterdam, Pays-Bas',
    hostContact: 'https://support.github.com/',
  },
  analytics: {
    measurementId: 'G-246N628L35',
  },
} as const

export function isCommercialLegalReady() {
  return Boolean(
    CLU_COMMERCIAL.legal.registration
    && CLU_COMMERCIAL.legal.mediatorName
    && CLU_COMMERCIAL.legal.mediatorUrl,
  )
}
