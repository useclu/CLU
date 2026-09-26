import { CLU_COMMERCIAL } from './commercial'

export type LegalDocumentId = 'LEGAL' | 'PRIVACY' | 'COOKIES' | 'CREDITS'
export type LegalSection = { title: string; paragraphs: string[]; bullets?: string[] }
export type LegalDocument = { id: LegalDocumentId; title: string; subtitle: string; sections: LegalSection[] }

const seller = CLU_COMMERCIAL.legal

function contactSection(): LegalSection[] {
  if (!seller.email) return []

  return [{
    title: 'Contact',
    paragraphs: [
      `Pour contacter CLU au sujet de CLU Métropole, de la confidentialité ou d’une demande relative aux données : ${seller.email}.`,
    ],
  }]
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  LEGAL: {
    id: 'LEGAL',
    title: 'Mentions légales',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate}`,
    sections: [
      {
        title: 'Hébergement',
        paragraphs: [
          `Le site est actuellement hébergé via ${seller.hostName}. Adresse connue de l’entité européenne de GitHub : ${seller.hostAddress}. Contact hébergeur : ${seller.hostContact}.`,
          'L’hébergement, le domaine ou l’architecture technique peuvent évoluer. Les présentes informations doivent être mises à jour si un changement modifie les mentions pertinentes.',
        ],
      },
      ...contactSection(),
      {
        title: 'Fonctionnement de CLU Métropole',
        paragraphs: [
          'CLU Métropole fonctionne actuellement sans système de compte utilisateur, sans connexion à un compte CLU, sans paiement intégré et sans synchronisation cloud des sauvegardes.',
          'Les sauvegardes de partie sont conservées localement dans le navigateur de l’utilisateur. Google Analytics peut être chargé uniquement après un choix explicite autorisant la mesure d’audience.',
        ],
      },
      {
        title: 'Propriété intellectuelle',
        paragraphs: [
          'Sauf indication contraire, les éléments propres à CLU et CLU Métropole — textes, interface, identité visuelle spécifique, mécanismes de jeu, créations graphiques originales et code spécifique non couvert par une licence tierce — restent protégés par les règles applicables en matière de propriété intellectuelle.',
          'CLU est historiquement issu de BULB pour une partie du projet public. Les composants, bibliothèques, données cartographiques, polices, icônes et autres éléments tiers restent soumis à leurs licences respectives.',
          'Les données cartographiques issues notamment d’OpenStreetMap/Protomaps et les bibliothèques telles que MapLibre restent soumises à leurs conditions de licence et d’attribution propres.',
        ],
      },
    ],
  },

  PRIVACY: {
    id: 'PRIVACY',
    title: 'Politique de confidentialité',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate}`,
    sections: [
      {
        title: '1. Principe général',
        paragraphs: [
          'CLU Métropole fonctionne actuellement sans compte utilisateur. Le jeu ne demande pas d’adresse email, de mot de passe, d’identifiant de connexion, de moyen de paiement ni de sauvegarde cloud.',
          'Les données de partie et les préférences sont principalement conservées localement dans le navigateur. Google Analytics est utilisé uniquement si l’utilisateur accepte la catégorie « Mesure d’audience ».',
        ],
      },
      {
        title: '2. Données conservées localement',
        paragraphs: [
          'localStorage est utilisé pour mémoriser notamment les paramètres du jeu, la langue, l’état du tutoriel et le choix relatif à Google Analytics.',
          'IndexedDB est utilisé pour stocker les sauvegardes de partie et leurs sauvegardes techniques locales. Ces données restent sur l’appareil et ne sont pas envoyées à une API de compte CLU dans la version actuelle.',
          'La suppression des données du site dans le navigateur peut supprimer ces réglages et sauvegardes locales.',
        ],
      },
      {
        title: '3. Google Analytics',
        paragraphs: [
          `Google Analytics est configuré avec l’identifiant ${CLU_COMMERCIAL.analytics.measurementId}. Son script n’est chargé par CLU Métropole que lorsque l’utilisateur accepte la mesure d’audience.`,
          'Le code appelle Google Analytics avec le paramètre anonymize_ip activé. Refuser Google Analytics n’empêche pas de jouer.',
          'Le consentement peut être modifié à tout moment depuis le bouton « Cookies ». Lorsque la mesure d’audience est refusée, CLU Métropole ne charge pas volontairement le script Google Analytics depuis cette couche du jeu.',
        ],
      },
      {
        title: '4. Contact par email',
        paragraphs: [
          `Si vous contactez CLU à l’adresse ${seller.email}, votre adresse d’expéditeur, le contenu de votre message et les éventuelles pièces jointes sont reçus afin de traiter votre demande. Ces informations ne proviennent pas du gameplay et ne servent pas à créer un compte utilisateur.`,
          'La messagerie de contact est fournie via Gmail. La conservation des messages dépend de la gestion de cette boîte de messagerie et des paramètres du fournisseur.',
        ],
      },
      {
        title: '5. Hébergement et ressources cartographiques',
        paragraphs: [
          'Le chargement du site et de certaines ressources cartographiques nécessite des requêtes réseau vers l’hébergement du site et vers les serveurs qui distribuent les fichiers cartographiques. Comme pour toute requête web, ces fournisseurs techniques peuvent recevoir les informations nécessaires à la transmission, notamment l’adresse IP et des informations de navigateur.',
          'CLU Métropole ne crée pas, dans la version actuelle, de compte ou de profil utilisateur à partir de ces requêtes. Les éventuels journaux techniques des fournisseurs d’hébergement ne sont pas définis par le code de CLU Métropole et dépendent de leurs propres pratiques.',
        ],
      },
      {
        title: '6. Finalités et base du traitement',
        paragraphs: [
          'Les stockages locaux nécessaires servent à fournir les fonctionnalités demandées : préférences, tutoriel, sauvegardes et mémorisation du choix de confidentialité.',
          'Google Analytics est utilisé uniquement pour mesurer l’audience et comprendre l’utilisation générale du site. Cette mesure d’audience optionnelle repose sur le consentement.',
          'Les messages reçus à l’adresse de contact sont utilisés uniquement pour lire, traiter et répondre à la demande correspondante.',
        ],
      },
      {
        title: '7. Durées de conservation',
        paragraphs: [
          'Les sauvegardes, paramètres et données locales restent dans le navigateur jusqu’à leur suppression par le jeu, par l’utilisateur ou par le navigateur.',
          'Le choix de consentement est mémorisé localement pendant au maximum 183 jours dans le code actuel, puis une nouvelle décision peut être demandée.',
          'La durée de conservation des données traitées par Google Analytics dépend de la configuration de la propriété Google Analytics et n’est pas définie dans ce dépôt de code. Elle doit être vérifiée dans l’administration Google Analytics.',
          'Les messages envoyés à l’adresse de contact peuvent rester dans la boîte Gmail jusqu’à leur suppression dans le cadre de la gestion de cette messagerie.',
        ],
      },
      {
        title: '8. Destinataires et services tiers',
        paragraphs: [
          'Google reçoit des données de mesure d’audience uniquement lorsque Google Analytics est autorisé.',
          'Google fournit également la messagerie Gmail utilisée pour le contact lorsqu’un utilisateur choisit volontairement d’envoyer un email à CLU.',
          'Les fournisseurs d’hébergement et de distribution des ressources techniques peuvent recevoir les données réseau nécessaires pour servir le site et les fichiers demandés.',
          'CLU Métropole ne transmet pas de sauvegardes de partie à un service de compte ou de synchronisation cloud dans la version actuelle.',
        ],
      },
      {
        title: '9. Vos choix et vos droits',
        paragraphs: [
          'Google Analytics peut être refusé dès le premier affichage du bandeau et le choix peut être modifié ensuite depuis « Cookies ». Le refus n’empêche pas l’accès au jeu.',
          'Le premier bandeau peut recueillir ce choix avec les boutons « Tout accepter » et « Tout refuser » : aucune case à cocher n’est nécessaire pour exprimer ce choix. Une case est proposée dans « Personnaliser » pour régler séparément la mesure d’audience.',
          'L’utilisateur peut également supprimer les données locales de CLU Métropole depuis les fonctions du jeu ou les réglages de stockage de son navigateur.',
          `Pour une demande liée à la confidentialité ou aux données : ${seller.email}.`,
        ],
      },
    ],
  },

  COOKIES: {
    id: 'COOKIES',
    title: 'Politique Cookies et stockage local',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate}`,
    sections: [
      {
        title: '1. Stockages nécessaires',
        paragraphs: [
          'CLU Métropole utilise des stockages locaux nécessaires au fonctionnement demandé par l’utilisateur. Ils servent notamment aux paramètres du jeu, à la langue, au tutoriel, aux sauvegardes et à la mémorisation du choix de confidentialité.',
          'Les sauvegardes de partie utilisent IndexedDB. Les préférences et le choix de consentement utilisent notamment localStorage.',
          'Ces stockages nécessaires ne servent pas à authentifier un compte utilisateur : la version actuelle de CLU Métropole ne comporte pas de système de compte.',
        ],
      },
      {
        title: '2. Google Analytics — optionnel',
        paragraphs: [
          `Google Analytics (${CLU_COMMERCIAL.analytics.measurementId}) est une mesure d’audience optionnelle. Son script n’est chargé que si l’utilisateur accepte la catégorie « Mesure d’audience ».`,
          'Le refus est proposé au même niveau que l’acceptation et n’empêche pas l’utilisation du jeu.',
        ],
      },
      {
        title: '3. Gestion du consentement',
        paragraphs: [
          'Le premier bandeau permet de « Tout refuser », « Personnaliser » ou « Tout accepter ». Cliquer sur « Tout accepter » constitue le choix positif qui autorise Google Analytics ; aucune case à cocher supplémentaire n’est nécessaire.',
          'Dans « Personnaliser », une case dédiée permet d’activer ou de désactiver uniquement la mesure d’audience.',
          'Le choix est enregistré localement afin de ne pas redemander une décision à chaque visite. Dans le code actuel, ce choix expire après 183 jours et peut être modifié à tout moment avec le bouton « Cookies ».',
        ],
      },
      {
        title: '4. Publicité',
        paragraphs: [
          'CLU Métropole n’active pas de traceur publicitaire dans le jeu. Les signaux publicitaires de Google Consent Mode restent refusés par cette couche.',
        ],
      },
      {
        title: '5. Suppression des données locales',
        paragraphs: [
          'L’utilisateur peut supprimer les données du site depuis son navigateur. Cette action peut également supprimer les sauvegardes locales de partie.',
          'Des cookies ou données déjà déposés par un service tiers après consentement peuvent nécessiter une suppression depuis le navigateur ou les outils du fournisseur concerné.',
        ],
      },
    ],
  },

  CREDITS: {
    id: 'CREDITS',
    title: 'Licences et crédits',
    subtitle: 'Principales licences et attributions utilisées par CLU',
    sections: [
      {
        title: 'OpenStreetMap & Protomaps',
        paragraphs: [
          'Les fonds cartographiques réels utilisés par CLU Métropole s’appuient notamment sur des données OpenStreetMap. OpenStreetMap est une base de données ouverte distribuée sous Open Data Commons Open Database License (ODbL).',
          'Attribution cartographique : © OpenStreetMap contributors. Lorsqu’un fond Protomaps fondé sur OpenStreetMap est utilisé, les attributions Protomaps / OpenStreetMap applicables doivent rester visibles.',
        ],
      },
      {
        title: 'MapLibre GL JS',
        paragraphs: [
          'CLU Métropole utilise MapLibre GL JS pour le rendu cartographique. MapLibre GL JS est distribué sous licence BSD 3-Clause. Les notices de copyright et conditions de licence applicables doivent être conservées.',
        ],
      },
      {
        title: 'PMTiles / Protomaps',
        paragraphs: [
          'Le format PMTiles et ses implémentations sont utilisés pour les cartes. Les licences et attributions propres aux implémentations utilisées doivent être conservées avec la distribution.',
        ],
      },
      {
        title: 'BULB / origine du projet public CLU',
        paragraphs: [
          'Le projet public CLU est historiquement issu de BULB. Les fragments réutilisés restent soumis aux licences et notices de copyright de leurs sources respectives.',
          'Les développements propres à CLU Métropole n’annulent jamais les obligations de licence applicables aux composants tiers réutilisés.',
        ],
      },
      {
        title: 'Dépendances, polices, icônes et audio',
        paragraphs: [
          'Chaque dépendance logicielle, police, icône, effet sonore, piste audio ou autre ressource tierce reste soumise à sa propre licence. Les crédits et fichiers de licence requis doivent être conservés.',
        ],
      },
    ],
  },
}
