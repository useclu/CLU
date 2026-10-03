import { CLU_COMMERCIAL } from './commercial'

export type LegalDocumentId = 'LEGAL' | 'TERMS' | 'PREMIUM' | 'PRIVACY' | 'COOKIES' | 'CREDITS'
export type LegalSection = { title: string; paragraphs: string[]; bullets?: string[]; notice?: boolean }
export type LegalDocument = { id: LegalDocumentId; title: string; subtitle: string; sections: LegalSection[] }

const seller = CLU_COMMERCIAL.legal
const premium = CLU_COMMERCIAL.premium

const versionLabel = `Version ${seller.version} — ${seller.effectiveDate}`

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  LEGAL: {
    id: 'LEGAL',
    title: 'Mentions légales',
    subtitle: versionLabel,
    sections: [
      {
        title: 'Éditeur et responsable de publication',
        paragraphs: [
          `${CLU_COMMERCIAL.productName} et le service CLU sont édités par ${seller.sellerName}, sous le nom CLU, en qualité de ${seller.status.toLowerCase()}.`,
          `Adresse de contact : ${seller.address}. E-mail : ${seller.email}. Téléphone : ${seller.phone}.`,
          `Responsable de publication : ${seller.sellerName}.`,
          'Aucun numéro d’immatriculation ou de TVA n’est indiqué dans cette version, aucun numéro n’ayant été communiqué à CLU pour publication.',
        ],
      },
      {
        title: 'Hébergement et infrastructure',
        paragraphs: [
          `Le site web est publié via ${seller.hostName}. Adresse indiquée pour l’entité européenne de GitHub : ${seller.hostAddress}. Contact : ${seller.hostContact}.`,
          `${seller.infrastructureName} fournit notamment ${seller.infrastructureDescription}. Ces prestataires peuvent traiter les données techniques strictement nécessaires à la fourniture de leurs services.`,
        ],
      },
      {
        title: 'Contact',
        paragraphs: [
          `Pour toute question sur CLU, un compte, un paiement, la confidentialité ou l’exercice de droits relatifs aux données personnelles : ${seller.email}.`,
          'Les demandes sont traitées dans les meilleurs délais, sans engagement de délai fixe sauf obligation légale contraire.',
        ],
      },
      {
        title: 'Propriété intellectuelle',
        paragraphs: [
          'Sauf indication contraire, les éléments propres à CLU et CLU Métropole — code spécifique, textes, interface, identité visuelle, mécaniques de jeu, créations graphiques originales, musiques et contenus originaux — sont protégés par les règles applicables en matière de propriété intellectuelle.',
          'Les bibliothèques, cartes, polices, icônes, formats, données et autres éléments tiers restent soumis à leurs licences respectives. Les crédits applicables figurent dans le document « Licences et crédits ».',
        ],
      },
      {
        title: 'Mise à jour des informations',
        paragraphs: [
          'Les présentes informations correspondent à la version indiquée. L’architecture technique, les prestataires ou les coordonnées peuvent évoluer ; la version publiée est alors mise à jour.',
        ],
      },
    ],
  },

  TERMS: {
    id: 'TERMS',
    title: 'Conditions générales d’utilisation',
    subtitle: versionLabel,
    sections: [
      {
        title: '1. Objet et acceptation',
        paragraphs: [
          'Les présentes conditions encadrent l’utilisation de CLU Métropole, des comptes CLU, des fonctions en ligne et des services associés.',
          'La création d’un compte requiert l’acceptation de la version en vigueur des présentes conditions. Une nouvelle acceptation peut être demandée en cas de modification importante.',
          'CLU est destiné aux personnes âgées de 18 ans ou plus. En créant un compte, l’utilisateur confirme avoir au moins 18 ans.',
        ],
      },
      {
        title: '2. Compte CLU',
        paragraphs: [
          'Un compte CLU est identifié par un pseudonyme. Un mot de passe peut être utilisé ; la connexion Google est facultative lorsqu’elle est disponible.',
          'L’utilisateur doit conserver ses moyens de connexion et son code de récupération de manière confidentielle. CLU ne réaffiche pas le code de récupération après sa création ou son renouvellement.',
          'Le partage, la vente ou le transfert d’un compte CLU à un tiers sont interdits. Un accès compromis doit être signalé à CLU dès que possible.',
        ],
      },
      {
        title: '3. Pseudonyme et identité publique',
        paragraphs: [
          'Le pseudonyme peut être visible par les autres participants dans les fonctions en ligne.',
          'Le pseudonyme peut être modifié au maximum une fois tous les 15 jours. CLU peut refuser ou modifier un pseudonyme manifestement abusif, trompeur, illicite ou utilisé pour usurper l’identité d’un tiers.',
        ],
      },
      {
        title: '4. Utilisation acceptable et sécurité',
        paragraphs: [
          'Il est interdit de tenter de contourner les contrôles d’accès, de perturber le service, d’exploiter une faille, d’automatiser des requêtes abusives, de frauder un paiement, d’accéder aux données d’autrui ou d’utiliser CLU à des fins illicites.',
          'CLU peut limiter, suspendre ou fermer un compte en cas de fraude, attaque, abus, triche portant atteinte au service ou tentative d’accès non autorisé. Lorsque cela est raisonnablement possible, la mesure est proportionnée à la situation.',
        ],
      },
      {
        title: '5. Parties, sauvegardes et contenus des joueurs',
        paragraphs: [
          'Les sauvegardes locales restent sur l’appareil de l’utilisateur tant qu’elles ne sont pas exportées ou utilisées dans une fonction en ligne.',
          'Les données nécessaires à une partie en ligne peuvent être traitées sur les serveurs CLU afin de synchroniser les participants, les permissions, l’état de la partie, les actions et les sauvegardes techniques.',
          'CLU ne revendique pas la propriété des créations originales réalisées par les joueurs dans leurs parties. L’utilisateur autorise uniquement les traitements techniques nécessaires à l’hébergement, la synchronisation, l’export et la transmission de la partie.',
          'Les fichiers de partie ou cartes exportés peuvent être transmis volontairement à d’autres personnes sous la responsabilité de l’utilisateur qui les partage.',
        ],
      },
      {
        title: '6. Disponibilité du service',
        paragraphs: [
          'CLU peut être interrompu temporairement pour maintenance, sécurité, mise à jour ou incident technique. Aucun service en ligne ne peut être garanti sans interruption permanente.',
          'CLU cherche à restaurer le service dans des délais raisonnables et peut, lorsqu’une panne importante affecte un service Premium, accorder une prolongation commerciale de la période Premium.',
        ],
      },
      {
        title: '7. Suppression du compte',
        paragraphs: [
          'L’utilisateur peut demander la suppression de son compte depuis l’interface prévue. La suppression ferme les sessions et retire les moyens de connexion associés.',
          'Le compte est anonymisé lorsque certaines références doivent être conservées pour la preuve de paiements, d’acceptations juridiques ou pour respecter des obligations applicables. Les données qui n’ont plus à être conservées sont supprimées ou anonymisées.',
          'La suppression d’un compte met fin à l’accès aux avantages Premium liés à ce compte. Le Premium n’est pas transférable vers un autre compte.',
        ],
      },
      {
        title: '8. Responsabilité et droits impératifs',
        paragraphs: [
          'CLU ne remplace aucune infrastructure réelle de transport et les données de simulation n’ont pas vocation à guider des décisions réelles.',
          'Aucune clause des présentes conditions ne supprime les garanties, recours ou droits impératifs dont un consommateur bénéficie en vertu de la loi applicable.',
        ],
      },
      {
        title: '9. Contact et évolution des conditions',
        paragraphs: [
          `Toute question ou réclamation peut être adressée à ${seller.email}.`,
          'Les conditions peuvent être mises à jour pour refléter l’évolution du service, de la sécurité ou des obligations applicables. Une nouvelle acceptation est demandée lorsque la modification le justifie.',
        ],
      },
    ],
  },

  PREMIUM: {
    id: 'PREMIUM',
    title: 'Conditions CLU Premium',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate} — ${premium.priceLabel} / ${premium.durationLabel}`,
    sections: [
      {
        title: '1. Offre et prix',
        paragraphs: [
          `${premium.productName} est proposé au prix de ${premium.priceLabel}, en euros, pour une période d’un mois. Il s’agit d’un paiement unique : aucun renouvellement automatique ni prélèvement récurrent n’est mis en place par CLU.`,
          'Offre de lancement BÊTA : pour tout achat Premium confirmé du 3 octobre au 2 novembre 2026 inclus, CLU accorde un mois Premium supplémentaire sans coût additionnel, soit deux mois Premium au total pour 3,99 €.',
          'Le prix affiché avant le paiement est celui applicable à l’achat en cours. Toute modification future de prix ne modifie pas une période déjà achetée.',
        ],
      },
      {
        title: '2. Activation et durée',
        paragraphs: [
          'Le Premium est activé après confirmation du paiement par Stripe. Une période achetée commence immédiatement si le compte n’est pas Premium.',
          'Si le compte dispose déjà d’une période Premium active, la durée accordée par l’achat est ajoutée à la date d’expiration existante. Pendant l’offre de lancement BÊTA, cette durée est de deux mois au total ; hors promotion, elle est d’un mois. À l’expiration, le compte redevient automatiquement Gratuit tant qu’un nouveau paiement n’est pas effectué.',
        ],
      },
      {
        title: '3. Avantages Premium',
        paragraphs: [
          'Pendant une période Premium active, le compte donne accès aux avantages suivants :',
        ],
        bullets: [
          'créer et héberger une partie en ligne CLU ;',
          'accéder à CLU Bureau, sous réserve d’une connexion Internet permettant de vérifier le statut Premium ;',
          'soutenir le développement et l’exploitation de CLU.',
        ],
      },
      {
        title: '4. Paiement',
        paragraphs: [
          'Les paiements sont traités par Stripe. CLU ne stocke pas le numéro complet de la carte bancaire ni le cryptogramme.',
          'CLU conserve les références techniques du paiement, le montant, la devise, les dates utiles et la période Premium accordée afin d’activer le service, prévenir les doublons et traiter les demandes de support ou de remboursement.',
          'Selon la configuration de Stripe, un reçu de paiement peut être envoyé à l’adresse e-mail communiquée à Stripe pendant le paiement.',
        ],
      },
      {
        title: '5. Activation immédiate et droit de rétractation',
        paragraphs: [
          'Pour les consommateurs bénéficiant du droit français ou d’une protection équivalente de l’Union européenne, un contrat conclu à distance ouvre en principe un délai de rétractation de 14 jours à compter de sa conclusion.',
          'Avant de quitter CLU pour Stripe, l’utilisateur demande expressément que la fourniture de CLU Premium commence avant la fin de ce délai. Si la période achetée a effectivement commencé et que l’utilisateur se rétracte dans le délai applicable, un montant proportionnel au service déjà fourni peut rester dû lorsque la loi le prévoit.',
          'L’utilisateur reconnaît également qu’après exécution complète du service, le droit de rétractation peut prendre fin dans les conditions prévues par la loi. Cette reconnaissance ne supprime ni la garantie légale de conformité ni les autres droits impératifs.',
          `La rétractation peut être exercée par une déclaration dénuée d’ambiguïté adressée à ${seller.email} ou à ${seller.address}.`,
        ],
      },
      {
        title: '6. Encadré — garantie légale de conformité du service numérique',
        notice: true,
        paragraphs: [
          `Le professionnel répondant de la garantie est ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
          'CLU Premium est un service numérique fourni de manière continue pendant la période achetée. La garantie légale de conformité s’applique pendant toute cette période : un mois hors offre de lancement, ou deux mois pour un achat bénéficiant de l’offre de lancement BÊTA.',
          'Pendant la période de garantie applicable, CLU doit fournir les mises à jour nécessaires au maintien de la conformité du service. Le consommateur peut demander une mise en conformité sans frais, sans retard injustifié et sans inconvénient majeur.',
          'Dans les cas prévus par la loi, notamment si la mise en conformité est refusée, impossible, excessivement retardée ou échoue, le consommateur peut demander une réduction du prix ou mettre fin au contrat. Les droits relatifs aux vices cachés restent également applicables lorsqu’ils le sont.',
        ],
      },
      {
        title: '7. Formulaire type de rétractation',
        paragraphs: [
          `À envoyer uniquement si vous souhaitez vous rétracter : à l’attention de ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
          'Je vous informe de ma décision de me rétracter de mon achat CLU Premium. Achat effectué le : [date]. Nom du consommateur : [nom]. Adresse : [adresse]. Date : [date]. Signature uniquement en cas d’envoi sur papier.',
        ],
      },
      {
        title: '8. Remboursements et incidents',
        paragraphs: [
          'CLU peut rembourser notamment un double paiement, un paiement ayant échoué à activer le Premium ou une situation technique vérifiable justifiant un remboursement, sans préjudice des remboursements imposés par la loi applicable.',
          'Un remboursement total d’un achat Premium peut entraîner le retrait de la période Premium correspondante. Lorsqu’un droit de rétractation est exercé après le début du service à la demande expresse du consommateur, le traitement du remboursement tient compte des règles impératives applicables, notamment d’un éventuel montant proportionnel au service déjà fourni.',
          'En cas d’indisponibilité importante imputable à CLU, une prolongation de la période Premium peut être accordée à la place ou en complément d’une autre solution lorsque cela est approprié, sans limiter les droits issus de la garantie légale de conformité.',
        ],
      },
      {
        title: '9. Compte et transfert',
        paragraphs: [
          'Le Premium est attaché au compte CLU ayant effectué l’achat. Il n’est ni revendable ni transférable vers un autre compte, sauf correction exceptionnelle effectuée par CLU lorsqu’une erreur technique est démontrée.',
          'La suppression volontaire du compte met fin à l’accès au Premium associé, sous réserve des droits de remboursement qui resteraient légalement applicables.',
        ],
      },
      {
        title: '10. Réclamations et règlement des litiges',
        paragraphs: [
          `Toute réclamation concernant ${premium.productName} peut être envoyée à ${seller.email}. CLU répond dans les meilleurs délais.`,
          'Aucune clause des présentes conditions ne prive le consommateur d’un recours ou d’un mécanisme de règlement des litiges rendu obligatoire par la loi applicable.',
        ],
      },
    ],
  },

  PRIVACY: {
    id: 'PRIVACY',
    title: 'Politique de confidentialité',
    subtitle: versionLabel,
    sections: [
      {
        title: '1. Responsable et contact',
        paragraphs: [
          `Le responsable des traitements décrits dans cette politique est ${seller.sellerName}, CLU. Contact : ${seller.email}. Adresse : ${seller.address}.`,
          'Cette politique décrit les traitements réalisés par CLU lui-même et les principaux prestataires utilisés pour fournir le service.',
        ],
      },
      {
        title: '2. Données de compte',
        paragraphs: [
          'CLU peut traiter l’identifiant interne du compte, le pseudonyme et sa forme normalisée, les dates de création et de modification, le statut Gratuit/Premium, la date d’expiration Premium et la date du dernier changement de pseudonyme.',
          'Lorsqu’un mot de passe est utilisé, CLU stocke uniquement un hash cryptographique du mot de passe. Le code de récupération est également stocké sous forme de hash et n’est pas réaffichable.',
          'Lorsqu’un compte Google est lié, CLU conserve l’identifiant Google stable nécessaire à cette liaison. CLU ne cherche pas à stocker l’adresse e-mail Google dans sa base de compte.',
          'Les sessions de connexion comportent des identifiants techniques, une date de création, une expiration et une date de dernière utilisation. Le jeton de session envoyé au navigateur est protégé par un cookie HttpOnly ; seule une empreinte du jeton est conservée côté serveur.',
        ],
      },
      {
        title: '3. Paiements et Premium',
        paragraphs: [
          'Stripe traite les informations nécessaires au paiement, notamment les données de carte, le nom et l’adresse e-mail saisis dans son interface. CLU ne reçoit pas le numéro complet de carte ni le cryptogramme.',
          'CLU conserve les identifiants de session et de paiement Stripe, le montant, la devise, les dates, les éventuelles informations de remboursement et les dates de début et de fin de Premium.',
          'Les acceptations des conditions juridiques sont enregistrées avec le type de document, sa version et la date d’acceptation afin de conserver une preuve du parcours contractuel.',
        ],
      },
      {
        title: '4. Jeu local et fonctions en ligne',
        paragraphs: [
          'Les paramètres, la langue, le tutoriel, le choix de confidentialité et les sauvegardes locales peuvent être conservés dans localStorage ou IndexedDB sur l’appareil.',
          'Pour les parties en ligne, CLU peut traiter le pseudonyme, l’identifiant utilisateur, les parties créées ou rejointes, les permissions, les actions nécessaires au jeu, l’état synchronisé de la partie et des snapshots techniques de reprise.',
          'Pendant une session en ligne active, un jeton technique temporaire de reconnexion peut être conservé dans sessionStorage afin de permettre une actualisation de la page pendant la période de reconnexion. Il est supprimé lorsque la session est quittée, fermée ou expire.',
          'CLU n’utilise pas les créations de partie des joueurs pour constituer une banque de contenus commerciale. Les données sont traitées pour fournir, sécuriser, restaurer ou permettre l’export de la partie.',
        ],
      },
      {
        title: '5. Données techniques, sécurité et support',
        paragraphs: [
          'Les fournisseurs techniques peuvent traiter l’adresse IP, des informations de navigateur, des en-têtes réseau et des journaux nécessaires au fonctionnement et à la sécurité. CLU n’enregistre pas volontairement l’adresse IP dans la table de compte D1 dans la version actuelle.',
          `Si l’utilisateur contacte ${seller.email}, CLU reçoit l’adresse d’expéditeur, le contenu du message et les pièces jointes éventuelles afin de traiter la demande. La messagerie est fournie par Google/Gmail.`,
        ],
      },
      {
        title: '6. Mesure d’audience',
        paragraphs: [
          `Google Analytics (${CLU_COMMERCIAL.analytics.measurementId}) n’est chargé par CLU qu’après consentement à la mesure d’audience. Refuser n’empêche pas d’utiliser le jeu.`,
          'Le choix peut être modifié à tout moment depuis le bouton « Cookies ». CLU configure le chargement Analytics uniquement après un consentement positif enregistré par cette interface.',
          'Google AdSense n’est pas activé dans la version de lancement. Si de la publicité ou des traceurs publicitaires sont activés ultérieurement, la politique et le mécanisme de consentement devront être mis à jour avant leur chargement lorsque cela est requis.',
        ],
      },
      {
        title: '7. Finalités',
        paragraphs: [
          'Les données sont utilisées pour créer et sécuriser le compte, authentifier l’utilisateur, fournir le jeu et les parties en ligne, gérer Premium et les paiements, fournir le support, prévenir la fraude et les abus, respecter les obligations applicables et améliorer le service lorsque l’utilisateur a consenti aux mesures facultatives.',
          'CLU ne vend pas les données personnelles des utilisateurs à des annonceurs.',
        ],
      },
      {
        title: '8. Bases légales des traitements',
        paragraphs: [
          'Création et gestion du compte, authentification, fourniture des fonctions de jeu en ligne et activation de Premium : exécution du contrat ou mesures précontractuelles demandées par l’utilisateur.',
          'Preuves de paiement, obligations comptables, fiscales ou de consommation et traitement des demandes d’exercice de droits : obligation légale lorsqu’un texte l’impose ; sinon exécution du contrat ou défense des droits de CLU selon le cas.',
          'Sécurité du service, prévention de la fraude, abus, attaques et protection de l’infrastructure : intérêt légitime de CLU, sous réserve de la mise en balance requise avec les droits et libertés des utilisateurs.',
          'Google Analytics et toute mesure d’audience facultative : consentement, retirable à tout moment depuis « Cookies ».',
        ],
      },
      {
        title: '9. Prestataires, destinataires et transferts internationaux',
        paragraphs: [
          'GitHub fournit l’hébergement du site statique. Cloudflare fournit notamment l’API, D1, R2, la distribution de cartes et des services réseau. Stripe fournit le paiement. Google fournit la connexion Google, Google Analytics et la messagerie Gmail utilisée pour le support.',
          'Ces prestataires peuvent traiter des données dans plusieurs pays. Lorsqu’un transfert de données personnelles hors de l’Espace économique européen nécessite une garantie particulière, il doit reposer sur un mécanisme reconnu par le droit applicable, tel qu’une décision d’adéquation, des clauses contractuelles types ou une autre garantie valable. Les informations détaillées sur les mécanismes utilisés par chaque prestataire figurent dans leurs documents de confidentialité et de traitement des données.',
        ],
      },
      {
        title: '10. Durées de conservation',
        paragraphs: [
          'Une session CLU expire normalement au bout de 30 jours. Les données ordinaires de diagnostic conservées directement par CLU, lorsqu’elles le sont, ont vocation à être supprimées après environ 30 jours ; des éléments strictement nécessaires à l’analyse d’un incident de sécurité peuvent être conservés jusqu’à 90 jours.',
          'Lorsqu’une partie en ligne est fermée, son état de session et ses snapshots techniques actifs sont supprimés de l’infrastructure de partie. Des éléments strictement nécessaires à la sécurité, à un litige ou à une obligation applicable peuvent être conservés séparément lorsqu’une telle conservation est nécessaire.',
          'Après suppression d’un compte, les moyens de connexion sont supprimés et le compte est anonymisé. Les références de paiement et preuves d’acceptation peuvent être conservées pendant la durée nécessaire aux obligations comptables, fiscales, de consommation, de prévention de la fraude ou de preuve applicables.',
          'Les données locales restent sur l’appareil jusqu’à leur suppression par le jeu, l’utilisateur ou le navigateur. La durée des données Google Analytics dépend également des réglages de la propriété Google Analytics.',
        ],
      },
      {
        title: '11. Droits et contrôle de vos données',
        paragraphs: [
          'Selon les conditions prévues par le RGPD et les autres lois applicables, l’utilisateur peut demander l’accès, la rectification ou l’effacement de ses données, la limitation d’un traitement, s’opposer à un traitement fondé sur l’intérêt légitime et exercer le droit à la portabilité lorsque ses conditions sont réunies.',
          'Le pseudonyme peut être modifié depuis le compte avec une limite d’un changement tous les 15 jours. Le consentement Google Analytics peut être retiré à tout moment depuis « Cookies », sans remettre en cause la licéité des traitements antérieurs au retrait.',
          `Pour toute demande relative aux données : ${seller.email}. L’utilisateur peut également introduire une réclamation auprès de la CNIL ou de l’autorité de protection des données compétente lorsqu’il bénéficie de ce droit.`,
        ],
      },
      {
        title: '12. Utilisateurs majeurs',
        paragraphs: [
          'La création d’un compte CLU est réservée aux personnes âgées de 18 ans ou plus. CLU ne conçoit pas le service comme un service destiné aux mineurs.',
        ],
      },
    ],
  },

  COOKIES: {
    id: 'COOKIES',
    title: 'Politique Cookies et stockage local',
    subtitle: versionLabel,
    sections: [
      {
        title: '1. Stockages nécessaires',
        paragraphs: [
          'CLU utilise des stockages nécessaires au fonctionnement demandé : préférences, langue, tutoriel, choix de confidentialité, sauvegardes locales et autres données techniques locales du jeu.',
          'IndexedDB est notamment utilisé pour les sauvegardes locales. localStorage est notamment utilisé pour des préférences et le choix de confidentialité.',
          'Lorsqu’un utilisateur se connecte, un cookie de session CLU nécessaire à l’authentification est utilisé. Il est configuré HttpOnly, Secure, SameSite=Lax et expire normalement au bout de 30 jours.',
        ],
      },
      {
        title: '2. Google Analytics — optionnel',
        paragraphs: [
          `Google Analytics (${CLU_COMMERCIAL.analytics.measurementId}) est une mesure d’audience facultative. Son script n’est chargé par CLU que si l’utilisateur accepte la catégorie « Mesure d’audience ».`,
          'Le refus est proposé au même niveau que l’acceptation et n’empêche pas l’utilisation du jeu ou du compte.',
        ],
      },
      {
        title: '3. Gestion du choix',
        paragraphs: [
          'Le bandeau permet de refuser, personnaliser ou accepter la mesure d’audience. Le choix est mémorisé localement afin de ne pas être demandé à chaque visite.',
          'Dans la version actuelle, ce choix est redemandé après environ 183 jours ou lorsqu’une nouvelle version du mécanisme de consentement le nécessite. Il peut être modifié à tout moment via « Cookies ».',
        ],
      },
      {
        title: '4. Publicité',
        paragraphs: [
          'Google AdSense n’est pas activé dans la version de lancement. CLU maintient les signaux publicitaires Google sur « refusé » dans cette couche tant qu’aucun mécanisme publicitaire conforme n’est activé.',
          'Si la publicité est activée ultérieurement, les catégories de consentement et cette politique seront mises à jour avant le chargement des traceurs lorsque cela est requis.',
        ],
      },
      {
        title: '5. Suppression et conséquences',
        paragraphs: [
          'L’utilisateur peut supprimer les données du site depuis les réglages de son navigateur. Cette action peut supprimer les préférences et les sauvegardes locales.',
          'Supprimer le cookie de session déconnecte le compte sur l’appareil. Des données déjà traitées par un service tiers après consentement peuvent nécessiter une suppression via les outils du navigateur ou du fournisseur concerné.',
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
          'Les fonds cartographiques réels utilisés par CLU Métropole s’appuient notamment sur des données OpenStreetMap, distribuées sous Open Data Commons Open Database License (ODbL).',
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
