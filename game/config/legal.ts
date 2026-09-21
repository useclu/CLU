import { CLU_COMMERCIAL } from './commercial'

export type LegalDocumentId = 'LEGAL' | 'CGV' | 'CGU' | 'PRIVACY' | 'COOKIES' | 'PREVIEW' | 'CREDITS'
export type LegalSection = { title: string; paragraphs: string[]; bullets?: string[] }
export type LegalDocument = { id: LegalDocumentId; title: string; subtitle: string; sections: LegalSection[] }

const seller = CLU_COMMERCIAL.legal
const preview = CLU_COMMERCIAL.preview

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  LEGAL: {
    id: 'LEGAL',
    title: 'Mentions légales',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate}`,
    sections: [
      {
        title: 'Éditeur et responsable de publication',
        paragraphs: [
          `Le site CLU et le service CLU Métropole sont édités, à titre individuel, par ${seller.sellerName}, sous le nom commercial ${seller.tradeName}.`,
          `Adresse de contact : ${seller.address}. Adresse électronique : ${seller.email}. Téléphone : ${seller.phone}.`,
          seller.registration
            ? `Immatriculation : ${seller.registration}.`
            : 'Immatriculation professionnelle : en cours de finalisation. Les paiements réels doivent rester désactivés tant que les informations obligatoires d’immatriculation ne sont pas renseignées.',
          seller.vat ? `Numéro de TVA : ${seller.vat}.` : 'Numéro de TVA : non renseigné à ce jour ; la mention sera adaptée au régime fiscal effectivement applicable.',
          `Directeur de la publication : ${seller.sellerName}.`,
        ],
      },
      {
        title: 'Hébergement',
        paragraphs: [
          `Le site est actuellement hébergé via ${seller.hostName}. Adresse connue de l’entité européenne de GitHub : ${seller.hostAddress}. Contact hébergeur : ${seller.hostContact}.`,
          'Le domaine, l’hébergeur ou l’architecture technique peuvent évoluer. La présente page sera mise à jour si un changement modifie les informations légales pertinentes.',
        ],
      },
      {
        title: 'Propriété intellectuelle',
        paragraphs: [
          'Sauf indication contraire, les éléments propres à CLU et CLU Métropole — textes, interface, identité visuelle spécifique, mécanismes de jeu, créations graphiques originales et code spécifique non couvert par une licence tierce — sont protégés par les règles applicables en matière de propriété intellectuelle.',
          'CLU est issu historiquement de BULB pour la partie éditeur public. Les composants, bibliothèques, données cartographiques, polices, icônes et autres éléments tiers restent soumis à leurs licences respectives. Les notices de licence et crédits applicables doivent être conservés et sont accessibles depuis la rubrique Licences & crédits lorsqu’ils sont requis.',
          'Les données cartographiques issues d’OpenStreetMap/Protomaps et les bibliothèques telles que MapLibre restent soumises à leurs conditions de licence et d’attribution propres.',
        ],
      },
      {
        title: 'Contact',
        paragraphs: [
          `Pour une question liée au service, à un compte, à un paiement, à la confidentialité ou à l’exercice d’un droit : ${seller.email}. Aucun délai contractuel de réponse n’est garanti.`,
        ],
      },
    ],
  },
  CGV: {
    id: 'CGV',
    title: 'Conditions générales de vente — CLU Métropole',
    subtitle: `Version ${seller.version} — applicables à compter du ${seller.effectiveDate}`,
    sections: [
      {
        title: '1. Objet et champ d’application',
        paragraphs: [
          'Les présentes conditions générales de vente (« CGV ») encadrent l’achat en ligne de l’accès à CLU Métropole par un consommateur. Elles s’appliquent à la commande passée via le site CLU et complètent les Conditions générales d’utilisation (« CGU »), la Politique de confidentialité et la Politique Cookies.',
          'Les droits impératifs accordés au consommateur par la loi applicable restent applicables. Aucune clause des présentes CGV n’a pour objet de supprimer un droit auquel il ne peut être renoncé contractuellement.',
        ],
      },
      {
        title: '2. Vendeur et service',
        paragraphs: [
          `Le service est exploité sous le nom ${seller.tradeName} par ${seller.sellerName}, ${seller.address}, contact : ${seller.email}.`,
          'CLU Métropole est un service numérique accessible via Internet depuis un navigateur compatible. Il s’agit d’un service web et non de la vente d’un support physique.',
        ],
      },
      {
        title: '3. Prix et nature du paiement',
        paragraphs: [
          `Le prix de référence de CLU Métropole est de ${CLU_COMMERCIAL.priceEuro.toFixed(2).replace('.', ',')} € en paiement unique. Il ne s’agit pas d’un abonnement et aucun renouvellement automatique n’est prévu.`,
          'Le montant total effectivement facturé, taxes comprises lorsqu’elles sont applicables, est affiché avant la validation définitive du paiement. Une conversion dans une autre devise peut être proposée par le prestataire de paiement ; le montant final affiché par celui-ci avant confirmation fait foi pour la transaction concernée.',
          'CLU ne promet aucun prix futur. Le prix peut être modifié pour de nouvelles commandes sans modifier rétroactivement une commande déjà payée.',
        ],
      },
      {
        title: '4. Semaine découverte',
        paragraphs: [
          `Une période découverte est prévue du ${preview.startIso} au ${preview.endIso} (${preview.zoneLabel}). Elle est globale : elle ne constitue pas un essai individuel de sept jours à compter de la première connexion.`,
          'Pendant cette période, l’accès invité peut être autorisé sans achat et sans compte. Créer un autre compte, utiliser un autre navigateur ou changer d’appareil ne crée pas une nouvelle période individuelle.',
          'La période gratuite peut être prolongée, suspendue ou modifiée lorsqu’un motif technique, opérationnel, de sécurité, juridique ou de lancement le justifie. Une modification n’a pas pour effet de créer un droit à une gratuité future.',
        ],
      },
      {
        title: '5. Commande et paiement',
        paragraphs: [
          'L’achat nécessite un compte CLU valide. Le client vérifie les informations essentielles de la commande, le prix et les présentes conditions avant de confirmer le paiement.',
          'Le paiement est traité par Stripe ou par un service Stripe associé. CLU n’a pas vocation à recevoir ni stocker le numéro complet de carte bancaire. Lorsque Stripe Managed Payments est activé pour une transaction, Stripe/Link intervient comme marchand officiel dans le périmètre présenté par Stripe, notamment pour les taxes indirectes, la fraude, certains litiges et le support transactionnel.',
          'L’accès payant n’est accordé qu’après confirmation serveur d’un paiement effectivement réussi. Une simple redirection du navigateur vers une page « paiement réussi » ne suffit pas à créer le droit d’accès.',
        ],
      },
      {
        title: '6. Mise à disposition et connexion Internet',
        paragraphs: [
          'Une connexion Internet active est nécessaire pour accéder à CLU Métropole. Le service peut vérifier la validité de la session et le droit d’accès au lancement et périodiquement pendant l’utilisation.',
          'Le coût, la qualité et la disponibilité de la connexion Internet du client relèvent de son fournisseur d’accès. Une panne du réseau du client ou d’un fournisseur technique tiers peut rendre temporairement le service indisponible.',
        ],
      },
      {
        title: '7. Durée, disponibilité, évolution et cessation',
        paragraphs: [
          'Aucune durée minimale ou perpétuelle d’exploitation de CLU Métropole n’est promise. L’achat ne constitue pas une promesse d’accès « à vie », « pour toujours » ou pour une durée déterminée.',
          'CLU peut être amené à modifier, suspendre ou cesser tout ou partie du service, notamment pour des raisons économiques, techniques, opérationnelles, de sécurité, légales, liées à un fournisseur, à l’hébergement ou à une cessation d’activité.',
          'Aucun calendrier de futures mises à jour, corrections, fonctionnalités, cartes, contenus ou améliorations n’est contractuellement garanti. Le service est acheté pour les fonctionnalités disponibles au moment de la commande, sous réserve des obligations légales applicables, notamment celles qui pourraient imposer certaines mises à jour de conformité ou de sécurité.',
          'Lorsqu’une règle impérative impose, dans une situation donnée, une information préalable, un remboursement, une réduction du prix, une mise en conformité ou tout autre recours, cette règle reste applicable.',
        ],
      },
      {
        title: '8. Droit de rétractation et accès immédiat',
        paragraphs: [
          'Lorsqu’un droit légal de rétractation est applicable, il est exercé dans les conditions et délais prévus par la loi applicable au consommateur.',
          'Lorsque la loi autorise la fourniture immédiate d’un service ou contenu numérique avec perte du droit de rétractation sous certaines conditions, CLU recueille, lorsque nécessaire, la demande expresse d’exécution immédiate et la reconnaissance des conséquences de cette demande avant le paiement.',
          'En dehors des remboursements, mises en conformité, réductions de prix, rétractations ou autres recours imposés par la législation applicable, CLU ne propose pas de politique générale de remboursement commercial volontaire.',
        ],
      },
      {
        title: '9. Garanties légales',
        paragraphs: [
          'Les garanties légales et règles de conformité applicables au service numérique demeurent applicables lorsqu’elles concernent la transaction. Elles ne sont pas écartées par les présentes CGV.',
          `Pour toute demande relative à une garantie légale : ${seller.email}.`,
        ],
      },
      {
        title: '10. Compte, sécurité et partage',
        paragraphs: [
          'Le droit d’accès payant est rattaché au compte CLU ayant réalisé ou reçu l’achat. Le client doit protéger son mot de passe et son code de récupération.',
          'L’utilisation normale sur plusieurs appareils est admise. Le partage public ou massif d’identifiants, la revente d’accès, la mise à disposition d’un compte à un nombre important de personnes ou les tentatives de contournement du paiement sont interdits.',
          'En cas d’activité fortement inhabituelle, CLU peut invalider des sessions et demander une nouvelle authentification. Les mesures lourdes de suspension définitive ne sont pas destinées à être déclenchées automatiquement sur la seule base d’un seuil technique ; un examen humain est privilégié lorsqu’il est raisonnablement possible.',
        ],
      },
      {
        title: '11. Sauvegardes locales',
        paragraphs: [
          'Les sauvegardes de CLU Métropole sont principalement stockées localement dans le navigateur ou sur l’appareil. Aucun service de sauvegarde cloud n’est promis sauf indication expresse contraire.',
          'Effacer les données du navigateur, réinitialiser l’appareil, désinstaller un navigateur, perdre un disque ou effectuer certaines opérations système peut supprimer définitivement des sauvegardes non exportées. CLU ne garantit pas la récupération d’une donnée locale supprimée et met à disposition, lorsque disponible, une fonction d’export manuel.',
        ],
      },
      {
        title: '12. Responsabilité',
        paragraphs: [
          'CLU met en œuvre des moyens raisonnables pour fournir le service, mais ne garantit pas une disponibilité continue, l’absence totale d’erreur ni une compatibilité avec tout matériel, toute extension de navigateur ou toute configuration non annoncée comme prise en charge.',
          'Dans les limites autorisées par la loi, CLU ne répond pas des conséquences provenant directement d’un équipement ou réseau du client, d’une suppression volontaire des données locales, d’un logiciel tiers, d’une extension, d’une utilisation contraire aux instructions ou d’un événement échappant raisonnablement à son contrôle.',
          'Aucune limitation prévue ici ne s’applique lorsqu’elle est interdite par une disposition impérative, notamment en matière de faute, de sécurité, de conformité ou de droits du consommateur lorsque la loi l’exige.',
        ],
      },
      {
        title: '13. Médiation et réclamation',
        paragraphs: [
          `Une réclamation préalable peut être adressée à ${seller.email}.`,
          seller.mediatorName
            ? `Médiateur de la consommation désigné : ${seller.mediatorName}, ${seller.mediatorAddress}, ${seller.mediatorUrl}.`
            : 'Médiateur de la consommation : à désigner et à renseigner avant l’activation des paiements réels. Le paiement doit rester désactivé tant que cette information obligatoire n’est pas finalisée.',
        ],
      },
      {
        title: '14. Droit applicable et règlement des litiges',
        paragraphs: [
          'Les présentes CGV sont rédigées sur la base du droit français pour l’activité exploitée depuis la France. Les règles protectrices impératives éventuellement applicables au consommateur en raison de son lieu de résidence restent réservées lorsqu’elles ne peuvent être écartées.',
          'Aucune clause n’a pour objet de priver un consommateur d’un tribunal ou d’un recours auquel la loi lui donne impérativement accès.',
        ],
      },
      {
        title: '15. Version des conditions',
        paragraphs: [
          'La version acceptée au moment de la commande est enregistrée avec la transaction lorsque le système de compte le permet. Les conditions peuvent évoluer pour l’avenir. Une modification importante concernant un contrat en cours sera traitée selon les exigences légales applicables.',
          'La version française constitue la version de référence rédactionnelle de CLU. Des traductions peuvent être proposées pour faciliter la compréhension sans réduire les droits impératifs reconnus au consommateur.',
        ],
      },
    ],
  },
  CGU: {
    id: 'CGU',
    title: 'Conditions générales d’utilisation',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate}`,
    sections: [
      {
        title: '1. Acceptation et accès',
        paragraphs: [
          'Les présentes CGU encadrent l’utilisation de CLU, de CLU Métropole et des fonctions de compte associées. L’accès à certaines fonctions peut exiger l’acceptation des présentes CGU.',
          'Pendant la période découverte, un accès invité peut être proposé. Après la fin de la période gratuite, l’accès à CLU Métropole peut être réservé aux comptes disposant d’un droit d’accès payant valide.',
        ],
      },
      {
        title: '2. Compte',
        paragraphs: [
          'Un compte est créé avec un pseudo, un mot de passe et une adresse électronique obligatoire. L’adresse électronique n’est pas publique et sert notamment à la récupération et à la sécurité du compte ; elle n’a pas besoin d’être confirmée pour créer le compte. Le pseudo peut être visible dans certaines interfaces ou fonctions futures.',
          'Le pseudo doit respecter les limites techniques affichées. CLU peut refuser un pseudo manifestement illicite, usurpant une identité, portant atteinte à un tiers ou perturbant le fonctionnement du service.',
          'Le changement de pseudo peut être limité dans le temps, notamment à un changement tous les trente jours.',
        ],
      },
      {
        title: '3. Mot de passe, récupération et sessions',
        paragraphs: [
          'L’utilisateur choisit un mot de passe d’au moins huit caractères et reste responsable de sa confidentialité. Les gestionnaires de mots de passe et le collage du mot de passe sont autorisés.',
          'Un code de récupération peut être fourni. L’utilisateur doit le conserver. La récupération automatique exige le pseudo, l’adresse électronique associée au compte et un code de récupération valide. Sans ces éléments, la récupération du compte peut être impossible.',
          'L’utilisateur peut déconnecter ses sessions. Une déconnexion globale peut être imposée pour des raisons de sécurité ou à la suite d’une activité très inhabituelle.',
        ],
      },
      {
        title: '4. Utilisations interdites',
        paragraphs: [
          'Il est notamment interdit de tenter d’accéder sans autorisation à un compte, au backend, à une base de données ou à une interface d’administration ; de perturber volontairement le service ; de contourner un paiement ; de revendre ou publier massivement des identifiants ; d’utiliser le service à des fins illicites ; ou de porter atteinte aux droits de tiers.',
          'L’analyse, l’interopérabilité, la sécurité et les usages autorisés par la loi restent réservés. Les présentes CGU n’ont pas pour objet d’interdire ce que la loi autorise impérativement.',
        ],
      },
      {
        title: '5. Détection d’activité inhabituelle',
        paragraphs: [
          'Pour protéger les comptes et limiter le partage massif, CLU peut utiliser un identifiant technique pseudonyme d’appareil et les informations de session strictement nécessaires. Un volume exceptionnel de nouveaux appareils, par exemple dix appareils nouveaux en vingt-quatre heures, peut créer une alerte de sécurité.',
          'Cette alerte n’entraîne pas automatiquement une interdiction définitive. Elle peut provoquer l’invalidation des sessions et une demande de reconnexion, puis un examen manuel si nécessaire.',
        ],
      },
      {
        title: '6. Disponibilité du service',
        paragraphs: [
          'Une connexion Internet est requise. Aucun niveau de service, taux de disponibilité ou délai de rétablissement contractuel n’est garanti.',
          'Des maintenances, changements techniques, incidents, défaillances de fournisseurs, mesures de sécurité ou contraintes légales peuvent rendre le service temporairement indisponible.',
          'CLU peut cesser son activité ou interrompre le service dans les conditions décrites dans les CGV, sans que cela puisse supprimer les droits impératifs éventuellement applicables.',
        ],
      },
      {
        title: '7. Sauvegardes et données de jeu',
        paragraphs: [
          'Les parties et données de gameplay restent principalement locales. L’utilisateur est responsable de l’export de ses sauvegardes importantes lorsque cette fonction est disponible.',
          'CLU ne promet pas un service de synchronisation cloud, de récupération après suppression locale ni de transfert automatique entre appareils.',
        ],
      },
      {
        title: '8. Contenu créé par l’utilisateur',
        paragraphs: [
          'Les noms de parties, lignes, stations et autres contenus de gameplay sont principalement conservés localement. Lorsque certains éléments sont transmis volontairement au serveur ou à un autre utilisateur, l’utilisateur reste responsable de ne pas y intégrer de contenu illicite ou portant atteinte aux droits de tiers.',
        ],
      },
      {
        title: '9. Suspension, sécurité et suppression du compte',
        paragraphs: [
          'CLU peut suspendre temporairement une session ou un compte lorsqu’une mesure est nécessaire pour protéger le service, enquêter sur une fraude au paiement, répondre à une attaque, empêcher un accès non autorisé ou respecter une obligation légale.',
          'Une fermeture définitive à l’initiative de CLU est réservée aux situations sérieuses et, hors urgence ou obligation légale, fait l’objet d’un examen humain.',
          'L’utilisateur peut demander la suppression de son compte. Certaines données liées aux transactions, à la preuve du contrat, à la fraude ou à des obligations légales peuvent devoir être conservées pendant la durée légalement nécessaire, sous une forme limitée.',
        ],
      },
      {
        title: '10. Modifications',
        paragraphs: [
          'Les CGU peuvent évoluer. La version et la date sont indiquées. Une nouvelle acceptation sera demandée lorsqu’elle est nécessaire compte tenu de l’importance du changement ou de la loi applicable.',
        ],
      },
    ],
  },
  PRIVACY: {
    id: 'PRIVACY',
    title: 'Politique de confidentialité — RGPD',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate}`,
    sections: [
      {
        title: '1. Responsable du traitement',
        paragraphs: [
          `Responsable : ${seller.sellerName}, exploitant de ${seller.tradeName}. Adresse : ${seller.address}. Contact données personnelles : ${seller.email}.`,
          'Cette politique décrit les traitements réalisés directement par CLU. Les prestataires externes disposent également de leurs propres politiques lorsqu’ils agissent comme responsables indépendants ou sous-traitants dans leur périmètre.',
        ],
      },
      {
        title: '2. Principe de minimisation',
        paragraphs: [
          'CLU cherche à collecter le minimum de données nécessaire. Les sauvegardes de gameplay ne sont pas destinées à être envoyées au serveur commercial : elles restent principalement dans IndexedDB/localement sur l’appareil.',
          'CLU ne vend pas les données personnelles des utilisateurs.',
        ],
      },
      {
        title: '3. Données de compte',
        paragraphs: [
          'Peuvent être traités : pseudo, identifiant interne du compte, hash du mot de passe, adresse email obligatoire pour le compte, données techniques nécessaires au code de récupération, dates de création et de mise à jour du compte, version des conditions acceptées. L’adresse email n’est pas affichée publiquement et n’est pas destinée à être utilisée à des fins marketing sans base juridique distincte.',
          'Le mot de passe n’est pas stocké en clair. Le code de récupération peut être stocké sous une forme de vérification et, lorsque la fonction « afficher mon code » est activée, sous une forme chiffrée permettant sa restitution uniquement après une vérification de sécurité.',
        ],
      },
      {
        title: '4. Sessions et sécurité',
        paragraphs: [
          'CLU traite un identifiant pseudonyme d’appareil choisi par le navigateur, un identifiant de session, des dates de création/dernière activité et un libellé technique limité de l’appareil ou navigateur afin de permettre la connexion, l’affichage des sessions, la déconnexion globale et la détection d’un partage massif.',
          'CLU ne prévoit pas d’utiliser une empreinte invasive du matériel (polices, GPU, etc.) comme identifiant principal. Les adresses IP ne sont pas volontairement conservées dans la base applicative pour l’anti-abus, sous réserve des journaux techniques pouvant être générés temporairement par des fournisseurs d’infrastructure pour la sécurité et le fonctionnement de leurs services.',
        ],
      },
      {
        title: '5. Paiement et propriété du jeu',
        paragraphs: [
          'CLU peut conserver l’identifiant de transaction, l’identifiant de session de paiement, l’état du droit d’accès, la date d’achat et les références nécessaires à la preuve de la transaction, au support, à la lutte contre la fraude et aux obligations légales.',
          'Les données complètes de carte bancaire sont traitées par Stripe et ne sont pas destinées à être enregistrées par CLU.',
        ],
      },
      {
        title: '6. Google Analytics',
        paragraphs: [
          'Google Analytics peut être utilisé pour mesurer l’audience uniquement après le consentement de l’utilisateur lorsque ce consentement est requis. L’utilisateur peut refuser aussi facilement qu’il accepte et retirer son choix depuis « Gérer mes cookies ».',
          'Si l’utilisateur refuse les cookies analytiques, CLU Métropole reste accessible dans les mêmes conditions fonctionnelles, sous réserve des cookies et stockages strictement nécessaires au service demandé.',
        ],
      },
      {
        title: '7. Finalités et bases juridiques',
        bullets: [
          'Créer et administrer le compte, authentifier l’utilisateur, fournir l’accès acheté : exécution du contrat ou mesures précontractuelles.',
          'Protéger les comptes, limiter la fraude, détecter des sessions massivement partagées et sécuriser le service : intérêt légitime de sécurité, sous réserve de mise en balance, ou nécessité contractuelle selon le traitement.',
          'Conserver certaines preuves de transaction et informations comptables : obligation légale lorsque applicable.',
          'Mesurer l’audience avec Google Analytics lorsqu’un consentement est nécessaire : consentement.',
          'Répondre à une demande de support ou d’exercice de droits : traitement nécessaire à la demande et/ou obligation légale.',
        ],
        paragraphs: [],
      },
      {
        title: '8. Destinataires et prestataires',
        paragraphs: [
          'Les données sont accessibles uniquement aux personnes et prestataires qui en ont besoin pour leur fonction. Les principaux prestataires envisagés sont notamment Cloudflare pour l’API et la base commerciale, Stripe/Link pour le paiement, GitHub pour l’hébergement statique du site, et Google pour Analytics si l’utilisateur y consent.',
          'Le choix exact des prestataires peut évoluer. La politique sera mise à jour lorsqu’un changement modifie substantiellement le traitement.',
        ],
      },
      {
        title: '9. Transferts internationaux',
        paragraphs: [
          'Certains prestataires peuvent traiter des données en dehors de l’Espace économique européen. Lorsqu’un transfert est soumis au RGPD, CLU s’appuie sur les mécanismes prévus par le droit applicable et sur les garanties mises en place par les prestataires concernés, lorsque requises.',
        ],
      },
      {
        title: '10. Durées de conservation',
        bullets: [
          'Compte actif : pendant la vie du compte, puis suppression ou anonymisation sous réserve des obligations légales.',
          'Sessions actives : pendant leur validité ; les informations de sécurité anciennes sont supprimées ou agrégées lorsqu’elles ne sont plus nécessaires.',
          'Événements anti-abus liés aux appareils : conservation courte destinée à détecter les rotations récentes ; l’objectif technique cible une durée limitée, par exemple trente jours, sauf incident de sécurité nécessitant une conservation justifiée plus longue.',
          'Données de transaction : pendant la durée nécessaire à la preuve de l’achat et aux obligations comptables, fiscales, de lutte contre la fraude ou de contentieux applicables.',
          'Consentement cookies : conservation pendant une durée limitée puis nouvelle demande ; le refus est également mémorisé afin de ne pas solliciter l’utilisateur à chaque visite.',
        ],
        paragraphs: [],
      },
      {
        title: '11. Droits des personnes',
        paragraphs: [
          'Selon les conditions prévues par le RGPD et la loi applicable, l’utilisateur peut notamment demander l’accès à ses données, leur rectification, leur effacement, la limitation de certains traitements, s’opposer à certains traitements fondés sur l’intérêt légitime, demander la portabilité lorsque les conditions sont réunies et retirer un consentement à tout moment pour l’avenir.',
          `Les demandes peuvent être adressées à ${seller.email}. Une preuve raisonnable d’identité ou de contrôle du compte peut être demandée lorsqu’elle est nécessaire pour éviter de communiquer des données à un tiers non autorisé.`,
          'L’utilisateur dispose également du droit d’introduire une réclamation auprès de la CNIL lorsqu’il estime que ses droits n’ont pas été respectés.',
        ],
      },
      {
        title: '12. Mineurs',
        paragraphs: [
          'CLU ne souhaite pas collecter de date de naissance pour le simple usage du jeu. La création d’un compte peut être accessible à un mineur, mais l’achat doit être réalisé par une personne ayant la capacité juridique nécessaire ou avec l’autorisation requise de son représentant légal.',
        ],
      },
      {
        title: '13. Décisions automatisées',
        paragraphs: [
          'Le système peut créer automatiquement une alerte de sécurité en cas de volume inhabituel d’appareils. Cette alerte n’a pas pour finalité de prononcer automatiquement une fermeture définitive du compte. Les décisions importantes de suspension définitive sont destinées à être examinées humainement, hors situation d’urgence technique ou exigence légale.',
        ],
      },
      {
        title: '14. Sécurité',
        paragraphs: [
          'CLU met en place des mesures proportionnées : mots de passe hashés, jetons de session stockés côté serveur sous forme non directement réutilisable lorsque possible, chiffrement du code de récupération lorsqu’il doit pouvoir être réaffiché, cookies de session HttpOnly/Secure en production, validation d’origine et séparation entre frontend statique et API.',
          'Aucune mesure ne peut garantir un risque nul. Les incidents significatifs sont traités conformément aux obligations légales applicables.',
        ],
      },
    ],
  },
  COOKIES: {
    id: 'COOKIES',
    title: 'Politique Cookies & stockages locaux',
    subtitle: `Version ${seller.version} — ${seller.effectiveDate}`,
    sections: [
      {
        title: '1. Principe',
        paragraphs: [
          'CLU utilise des cookies et technologies de stockage local pour faire fonctionner le service, mémoriser certains choix et, avec consentement lorsque nécessaire, mesurer l’audience.',
          'Les traceurs non strictement nécessaires ne sont pas chargés avant le choix de l’utilisateur lorsque le consentement est requis. Refuser doit être aussi simple qu’accepter.',
        ],
      },
      {
        title: '2. Cookies strictement nécessaires',
        paragraphs: [
          'Le cookie de session du compte permet d’authentifier l’utilisateur auprès de l’API. Il est nécessaire lorsqu’un compte est utilisé. En production il doit être configuré HttpOnly, Secure et avec une politique SameSite adaptée.',
          'Des protections techniques ou fournisseurs d’infrastructure peuvent également utiliser des cookies strictement nécessaires à la sécurité, à la répartition de charge ou à la prévention des abus.',
        ],
      },
      {
        title: '3. Stockages locaux CLU Métropole',
        paragraphs: [
          'localStorage peut mémoriser les préférences d’interface, la langue, le choix cookies, un identifiant pseudonyme d’appareil et des états non sensibles nécessaires à l’expérience locale.',
          'IndexedDB stocke notamment les sauvegardes CLU Métropole. Ces données restent sur l’appareil sauf action ou fonctionnalité explicitement décrite comme une synchronisation ou un transfert.',
          'Supprimer les données du site depuis le navigateur peut supprimer ces informations et les sauvegardes locales.',
        ],
      },
      {
        title: '4. Google Analytics',
        paragraphs: [
          'Google Analytics est classé comme mesure d’audience non essentielle dans la configuration CLU Métropole. Il est chargé uniquement si l’utilisateur accepte la catégorie « Mesure d’audience » lorsque le consentement est nécessaire.',
          'Le refus de Google Analytics n’empêche pas l’accès au jeu. Le choix peut être modifié à tout moment via « Gérer mes cookies ».',
        ],
      },
      {
        title: '5. Publicité',
        paragraphs: [
          'CLU Métropole n’utilise pas la publicité comme fonctionnalité de son jeu. Tout traceur publicitaire éventuellement présent au niveau du site hôte doit rester soumis au consentement applicable et ne doit pas être activé pour la partie jeu avant ce consentement. Si de la publicité est ajoutée à CLU Métropole à l’avenir, la présente politique et le panneau de consentement seront mis à jour avant son activation lorsque cela est requis.',
        ],
      },
      {
        title: '6. Gestion du consentement',
        paragraphs: [
          'Le premier niveau de la bannière propose « Tout accepter », « Tout refuser » et « Personnaliser » sans rendre le refus plus difficile. Les catégories facultatives restent désactivées tant qu’aucun consentement valable n’a été donné.',
          'Le consentement peut être retiré à tout moment. Le retrait empêche les nouveaux dépôts/lectures facultatifs relevant de CLU ; certains cookies déjà déposés par des tiers peuvent nécessiter leur suppression selon les mécanismes fournis par le navigateur ou le fournisseur concerné.',
        ],
      },
    ],
  },

  CREDITS: {
    id: 'CREDITS',
    title: 'Licences & crédits',
    subtitle: 'Principales licences et attributions utilisées par CLU',
    sections: [
      {
        title: 'OpenStreetMap & Protomaps',
        paragraphs: [
          'Les fonds cartographiques réels de CLU Métropole sont notamment produits à partir de données OpenStreetMap. OpenStreetMap est une base de données ouverte mise à disposition sous Open Data Commons Open Database License (ODbL).',
          'Attribution cartographique : © OpenStreetMap contributors. Pour les basemaps Protomaps dérivés d’OpenStreetMap, l’attribution Protomaps / OpenStreetMap applicable doit rester visible sur la carte interactive.',
          'Les données ou sources additionnelles éventuellement intégrées à OpenStreetMap restent soumises aux crédits et conditions mentionnés par OpenStreetMap et leurs fournisseurs respectifs.',
        ],
      },
      {
        title: 'MapLibre GL JS',
        paragraphs: [
          'CLU Métropole utilise MapLibre GL JS pour le rendu cartographique. MapLibre GL JS est distribué sous licence BSD 3-Clause. Les avis de copyright et conditions de licence applicables doivent être conservés dans les redistributions concernées.',
          'Copyright © MapLibre contributors et autres titulaires mentionnés dans le fichier de licence officiel de MapLibre GL JS.',
        ],
      },
      {
        title: 'PMTiles / Protomaps',
        paragraphs: [
          'Le format et les implémentations PMTiles sont utilisés pour les cartes locales. Les implémentations de référence PMTiles sont publiées sous licence BSD 3-Clause ; la spécification PMTiles est placée dans le domaine public ou sous CC0 lorsque applicable.',
          'Copyright © 2021 et suivants Protomaps LLC et contributeurs pour les implémentations concernées.',
        ],
      },
      {
        title: 'BULB / héritage du projet CLU public',
        paragraphs: [
          'Le projet public CLU est historiquement issu de BULB. Le dépôt BULB de SlamaFR est publié sous licence MIT et repose lui-même sur le starter Nightrunner ; la notice MIT d’origine doit être conservée pour les portions concernées.',
          'Copyright © 2023 notKamui — MIT License, pour les éléments couverts par la notice du dépôt BULB.',
          'CLU Métropole possède ensuite son propre code et ses propres systèmes de jeu ; l’existence de composants propriétaires n’annule jamais les licences applicables aux composants tiers réutilisés.',
        ],
      },
      {
        title: 'Dépendances, polices, icônes et audio',
        paragraphs: [
          'Chaque dépendance logicielle, police, icône, effet sonore, morceau audio ou autre ressource tierce reste soumise à sa licence propre. Les crédits présents dans le dépôt, les paquets distribués ou les fichiers de licence associés doivent être conservés lorsqu’ils sont requis.',
          'Avant la Release Candidate 1.0, un inventaire final des dépendances et ressources du projet complet doit être effectué à partir du package.json/pnpm-lock et des fichiers d’assets réellement livrés. La présente page ne prétend pas remplacer cet inventaire exhaustif tant que le projet complet n’a pas été audité.',
        ],
      },
    ],
  },
  PREVIEW: {
    id: 'PREVIEW',
    title: 'Règles de la semaine découverte CLU Métropole',
    subtitle: 'Accès gratuit temporaire mondial',
    sections: [
      {
        title: '1. Dates',
        paragraphs: [
          `La période découverte est programmée du lundi 21 septembre 2026 à 12h00 au lundi 28 septembre 2026 à 12h00, heure de Paris. Le serveur constitue la référence pour déterminer si la période est ouverte.`,
        ],
      },
      {
        title: '2. Accès invité',
        paragraphs: [
          'Pendant cette période, un utilisateur peut jouer en invité sans créer de compte, après avoir pris connaissance des règles et accepté les CGU nécessaires à l’utilisation du service.',
          'Le mode invité n’ouvre aucun droit au-delà de la période découverte. Les sauvegardes restent locales et peuvent être conservées sur l’appareil, mais elles ne permettent pas de contourner le verrou d’accès après la fin de la période.',
        ],
      },
      {
        title: '3. Comptes pendant la période gratuite',
        paragraphs: [
          'La création d’un compte est facultative pendant la semaine découverte. Un compte non payant peut jouer tant que la période globale est active.',
          'À la fin de la période gratuite, un compte qui ne possède pas CLU Métropole ne peut plus entrer dans le jeu jusqu’à l’achat. Un compte ayant déjà acheté le jeu continue d’accéder normalement au service.',
        ],
      },
      {
        title: '4. Pas de renouvellement par appareil',
        paragraphs: [
          'La période n’est pas recalculée par utilisateur. Changer de navigateur, d’appareil, de compte ou effacer les données locales n’accorde pas sept nouveaux jours.',
        ],
      },
      {
        title: '5. Modification exceptionnelle',
        paragraphs: [
          'CLU peut prolonger, suspendre ou modifier l’opération gratuite lorsqu’un besoin technique, de sécurité, juridique ou de lancement le justifie. Une prolongation éventuelle sera communiquée dans le service et ne constitue pas un engagement de renouveler l’opération à l’avenir.',
        ],
      },
    ],
  },
}
