export const CLU_COMMERCIAL = {
  productName: 'CLU Métropole',

  legal: {
    version: '1.1',
    effectiveDate: '3 octobre 2026',
    effectiveDateIso: '2026-10-03',

    sellerName: 'Vincent DUAUX',
    tradeName: 'CLU',
    address: '24 rue Voltaire, 60100 Creil, France',
    email: 'useclunetworks@gmail.com',
    phone: '+33 7 44 93 98 21',
    status: 'Personne physique',
    registration: '',
    vat: '',
    operatingCountry: 'Maroc',

    hostName: 'GitHub Pages / GitHub',
    hostAddress: 'GitHub B.V., Prins Bernhardplein 200, 1097 JB Amsterdam, Pays-Bas',
    hostContact: 'https://support.github.com/',

    infrastructureName: 'Cloudflare',
    infrastructureDescription: 'API, base D1, stockage R2, cartes et services réseau CLU',
  },

  premium: {
    productName: 'CLU Premium',
    priceLabel: '3,99 €',
    currency: 'EUR',
    durationLabel: '1 mois',
    automaticRenewal: false,
    launchOffer: {
      // 3 octobre -> 2 novembre 2026 inclus, selon les dates calendaires de Paris.
      startIso: '2026-10-02T22:00:00.000Z',
      endExclusiveIso: '2026-11-02T23:00:00.000Z',
      purchasedMonths: 1,
      bonusMonths: 1,
    },
  },

  legalVersions: {
    accountTerms: '1.1',
    premiumTerms: '1.1',
  },

  // Google Analytics reste activable uniquement après consentement.
  analytics: {
    measurementId: 'G-246N628L35',
  },
} as const


export function isCluPremiumLaunchOfferActive(now = Date.now()): boolean {
  const start = Date.parse(CLU_COMMERCIAL.premium.launchOffer.startIso)
  const end = Date.parse(CLU_COMMERCIAL.premium.launchOffer.endExclusiveIso)
  return Number.isFinite(now) && now >= start && now < end
}

export function cluPremiumGrantedMonths(now = Date.now()): number {
  return isCluPremiumLaunchOfferActive(now)
    ? CLU_COMMERCIAL.premium.launchOffer.purchasedMonths + CLU_COMMERCIAL.premium.launchOffer.bonusMonths
    : CLU_COMMERCIAL.premium.launchOffer.purchasedMonths
}


/** Le statut BÊTA Online suit la période de lancement annoncée au public. */
export function isCluOnlineBetaActive(now = Date.now()): boolean {
  return isCluPremiumLaunchOfferActive(now)
}
