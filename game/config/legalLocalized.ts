import { CLU_COMMERCIAL } from './commercial'
import { LEGAL_DOCUMENTS, type LegalDocument, type LegalDocumentId } from './legal'
import type { GameLocale } from '../types/i18n'

const seller = CLU_COMMERCIAL.legal
const premium = CLU_COMMERCIAL.premium
const analyticsId = CLU_COMMERCIAL.analytics.measurementId

type LocalizedLegalLocale = Exclude<GameLocale, 'fr'>
type LocalizedLegalMeta = {
  versionWord: string
  effectiveDate: string
  durationLabel: string
  priceLabel: string
  infrastructureDescription: string
}

const LOCALIZED_LEGAL_META: Record<LocalizedLegalLocale, LocalizedLegalMeta> = {
  en: { versionWord: 'Version', effectiveDate: '3 October 2026', durationLabel: '1 month', priceLabel: '€3.99', infrastructureDescription: 'the CLU API, D1 database, R2 storage, maps and network services' },
  de: { versionWord: 'Version', effectiveDate: '3. Oktober 2026', durationLabel: '1 Monat', priceLabel: '3,99 €', infrastructureDescription: 'die CLU-API, D1-Datenbank, R2-Speicher, Karten und Netzwerkdienste' },
  nl: { versionWord: 'Versie', effectiveDate: '3 oktober 2026', durationLabel: '1 maand', priceLabel: '€ 3,99', infrastructureDescription: 'de CLU-API, D1-database, R2-opslag, kaarten en netwerkdiensten' },
  es: { versionWord: 'Versión', effectiveDate: '3 de octubre de 2026', durationLabel: '1 mes', priceLabel: '3,99 €', infrastructureDescription: 'la API de CLU, la base de datos D1, el almacenamiento R2, los mapas y los servicios de red' },
  it: { versionWord: 'Versione', effectiveDate: '3 ottobre 2026', durationLabel: '1 mese', priceLabel: '3,99 €', infrastructureDescription: 'l’API CLU, il database D1, l’archiviazione R2, le mappe e i servizi di rete' },
  pt: { versionWord: 'Versão', effectiveDate: '3 de outubro de 2026', durationLabel: '1 mês', priceLabel: '3,99 €', infrastructureDescription: 'a API do CLU, a base de dados D1, o armazenamento R2, os mapas e os serviços de rede' },
  pl: { versionWord: 'Wersja', effectiveDate: '3 października 2026', durationLabel: '1 miesiąc', priceLabel: '3,99 €', infrastructureDescription: 'interfejs API CLU, bazę danych D1, magazyn R2, mapy i usługi sieciowe' },
}

const legalSubtitle = (locale: LocalizedLegalLocale) => {
  const meta = LOCALIZED_LEGAL_META[locale]
  return `${meta.versionWord} ${seller.version} — ${meta.effectiveDate}`
}

const premiumSubtitle = (locale: LocalizedLegalLocale) => {
  const meta = LOCALIZED_LEGAL_META[locale]
  return `${meta.versionWord} ${seller.version} — ${meta.effectiveDate} — ${meta.priceLabel} / ${meta.durationLabel}`
}

const localizedInfrastructureDescription = (locale: LocalizedLegalLocale) => LOCALIZED_LEGAL_META[locale].infrastructureDescription

const S = (title: string, paragraphs: string[] = [], bullets?: string[], notice = false) => ({ title, paragraphs, bullets, notice })
const D = (id: LegalDocumentId, title: string, documentSubtitle: string, sections: ReturnType<typeof S>[]): LegalDocument => ({
  id,
  title,
  subtitle: documentSubtitle,
  sections,
})
type Pack = Record<LegalDocumentId, LegalDocument>

const EN: Pack = {
  LEGAL: D('LEGAL', 'Legal notice', legalSubtitle('en'), [
    S('Publisher and publication manager', [
      `${CLU_COMMERCIAL.productName} and the CLU service are published by ${seller.sellerName}, trading as CLU, as a natural person.`,
      `Contact address: ${seller.address}. Email: ${seller.email}. Phone: ${seller.phone}. Publication manager: ${seller.sellerName}.`,
      'No business-registration or VAT number is stated in this version because none was provided to CLU for publication.',
    ]),
    S('Hosting and infrastructure', [
      `The website is published via ${seller.hostName}. Address stated for GitHub's European entity: ${seller.hostAddress}. Contact: ${seller.hostContact}.`,
      `${seller.infrastructureName} provides in particular ${localizedInfrastructureDescription('en')}. These providers may process technical data strictly necessary to deliver their services.`,
    ]),
    S('Contact', [`Questions about CLU, accounts, payments, privacy or personal-data rights may be sent to ${seller.email}. Requests are handled as soon as reasonably possible.`]),
    S('Intellectual property', [
      'Unless stated otherwise, CLU-specific code, text, interface, visual identity, game systems, original graphics, music and original content are protected by applicable intellectual-property rules.',
      'Libraries, maps, fonts, icons, formats, data and other third-party materials remain subject to their own licences. See “Licences and credits”.',
    ]),
  ]),

  TERMS: D('TERMS', 'Terms of use', legalSubtitle('en'), [
    S('1. Scope and acceptance', [
      'These terms govern CLU Métropole, CLU accounts, online features and related services. Creating an account requires acceptance of the current version. A new acceptance may be requested after a material change.',
      'CLU accounts are reserved for people aged 18 or over. By creating an account, the user confirms being at least 18.',
    ]),
    S('2. CLU account', [
      'A CLU account is identified by a username. A password may be used and Google sign-in is optional when available. Login details and the recovery code must be kept confidential.',
      'Selling, sharing or transferring a CLU account to another person is prohibited.',
    ]),
    S('3. Username and public identity', [
      'The username may be visible to other participants in online features. It can be changed at most once every 15 days.',
      'CLU may refuse or change a clearly abusive, deceptive, unlawful or impersonating username.',
    ]),
    S('4. Acceptable use and security', [
      'Users must not bypass access controls, disrupt the service, exploit vulnerabilities, automate abusive requests, commit payment fraud, access another user’s data or use CLU unlawfully.',
      'CLU may limit, suspend or close an account in cases of fraud, attacks, abuse, harmful cheating or unauthorised-access attempts.',
    ]),
    S('5. Games, saves and user content', [
      'Local saves stay on the device unless exported or used in an online feature. Online games may require server-side processing of usernames, user IDs, permissions, actions, game state and technical recovery snapshots.',
      'CLU does not claim ownership of original creations made by players in their games. Users grant only the technical rights needed to host, synchronise, export and transmit the game.',
    ]),
    S('6. Availability and account deletion', [
      'CLU may be temporarily unavailable for maintenance, security updates or incidents. A significant Premium outage may lead to a commercial extension of Premium.',
      'Deleting an account closes sessions and removes login methods. Data that must remain for payment, legal evidence or applicable obligations may be anonymised and retained. Premium access ends and is not transferable.',
    ]),
    S('7. Mandatory rights and contact', [
      'Nothing in these terms removes mandatory consumer guarantees, remedies or rights under applicable law.',
      `Questions or complaints may be sent to ${seller.email}.`,
    ]),
  ]),

  PREMIUM: D('PREMIUM', 'CLU Premium terms', premiumSubtitle('en'), [
    S('1. Offer and price', [`${premium.productName} costs ${LOCALIZED_LEGAL_META.en.priceLabel} for one month. It is a one-time payment with no automatic renewal or recurring charge by CLU.`, 'BETA launch offer: Premium purchases confirmed from 3 October through 2 November 2026 inclusive receive one additional Premium month at no extra cost, for two months total at €3.99.']),
    S('2. Activation and duration', [
      'Premium is activated after Stripe confirms payment. If the account is not Premium, the purchased month starts immediately.',
      'If Premium is already active, the duration granted by the purchase is added to the existing expiry date. During the BETA launch offer the total granted duration is two months; outside the offer it is one month. After expiry, the account automatically returns to Free until another payment is made.',
    ]),
    S('3. Premium benefits', ['While Premium is active, the account can:'], [
      'create and host an online CLU game;',
      'access CLU Desktop with an Internet connection used to verify Premium status;',
      'support the development and operation of CLU.',
    ]),
    S('4. Payment', [
      'Payments are processed by Stripe. CLU does not store the complete bank-card number or card security code.',
      'CLU stores technical payment references, amount, currency, relevant dates and the Premium period for activation, duplicate prevention and support/refund handling.',
    ]),
    S('5. Immediate activation and withdrawal', [
      'Before being redirected to Stripe, the user expressly requests immediate Premium activation after payment confirmation, without waiting for any withdrawal period to expire.',
      `This request does not remove mandatory statutory rights. Withdrawal, refund and legal exceptions depend on the law applicable to the consumer. Requests may be sent to ${seller.email}.`,
    ]),
    S('6. Refunds and incidents', [
      'CLU may refund duplicate payments, payments that failed to activate Premium or other verifiable technical situations, without limiting refunds required by law.',
      'A full refund may remove the corresponding Premium period. A major outage attributable to CLU may also lead to a Premium extension.',
    ]),
    S('7. Account and complaints', [
      'Premium is attached to the purchasing CLU account and is not resellable or transferable, except for an exceptional correction by CLU after a proven technical error.',
      `Premium complaints may be sent to ${seller.email}. Nothing in these terms removes any mandatory dispute-resolution mechanism or remedy.`,
    ]),
  ]),

  PRIVACY: D('PRIVACY', 'Privacy policy', legalSubtitle('en'), [
    S('1. Controller and contact', [`The controller described here is ${seller.sellerName}, CLU. Contact: ${seller.email}. Address: ${seller.address}.`]),
    S('2. Account data', [
      'CLU may process the internal account ID, username and normalised username, account dates, Free/Premium status, Premium expiry and the last username-change date.',
      'Passwords and recovery codes are stored only as cryptographic hashes. If Google is linked, CLU stores the stable Google identifier needed for the link and does not intentionally store the Google email address in the account database.',
      'Sessions include technical identifiers, creation, expiry and last-use dates. The browser receives an HttpOnly session token while only a hash of that token is stored server-side.',
    ]),
    S('3. Payments and legal records', [
      'Stripe processes the payment information entered in its interface, including card data, name and email. CLU does not receive the full card number or security code.',
      'CLU stores Stripe session/payment references, amount, currency, dates, refund information when available, Premium periods and legal-document acceptance records.',
    ]),
    S('4. Local and online game data', [
      'Settings, language, tutorial state, privacy choice and local saves may be stored in localStorage or IndexedDB.',
      'Online games may process the username, user ID, games created or joined, permissions, actions, synchronised game state and technical recovery snapshots. While an online session is active, a temporary reconnection token may be stored in sessionStorage so a page reload can recover during the reconnection window; it is removed when the session is left, closed or expires. CLU does not reuse player creations as a commercial content bank.',
    ]),
    S('5. Technical data, support and analytics', [
      'Technical providers may process IP addresses, browser information, network headers and logs needed for operation and security. CLU does not intentionally store the IP address in the D1 account table in the current version.',
      `Support emails sent to ${seller.email} are processed through Google/Gmail. Google Analytics (${analyticsId}) is loaded by CLU only after audience-measurement consent. Google AdSense is not active in the launch version.`,
    ]),
    S('6. Purposes and recipients', [
      'Data are used to create and secure accounts, authenticate users, provide local and online gameplay, manage Premium and payments, provide support, prevent fraud/abuse, meet applicable obligations and measure audience where consent is given.',
      'GitHub hosts the static website; Cloudflare provides the API, D1, R2, map delivery and network services; Stripe provides payments; Google provides Google sign-in, Analytics and Gmail. CLU does not sell users’ personal data to advertisers.',
    ]),
    S('7. Retention', [
      'A CLU session normally expires after 30 days. Ordinary diagnostic data directly retained by CLU are intended to be deleted after about 30 days; security-incident information may be kept for up to 90 days where necessary.',
      'When an online game is closed, its active session state and technical snapshots are deleted from the game infrastructure. Information strictly required for security, a dispute or an applicable obligation may be retained separately where necessary.',
      'After account deletion, login methods are removed and the account is anonymised. Payment and legal-evidence records may be retained for the period required by applicable accounting, tax, consumer, fraud-prevention or evidentiary obligations.',
    ]),
    S('8. Your rights', [
      'Users can export account data, request correction, delete their account and exercise rights granted by applicable law. The username can be changed once every 15 days. Analytics consent can be withdrawn at any time from “Cookies”.',
      `Data requests may be sent to ${seller.email}. Users may also contact the competent data-protection authority where applicable.`,
    ]),
  ]),

  COOKIES: D('COOKIES', 'Cookie and local storage policy', legalSubtitle('en'), [
    S('1. Necessary storage', [
      'CLU uses storage needed for requested features: preferences, language, tutorial state, privacy choice, local saves and other technical local game data.',
      'IndexedDB is used in particular for local saves; localStorage is used in particular for preferences and the privacy choice. When signed in, CLU uses a necessary authentication cookie configured HttpOnly, Secure and SameSite=Lax, normally for 30 days.',
    ]),
    S('2. Google Analytics — optional', [`Google Analytics (${analyticsId}) is optional audience measurement. CLU loads it only after consent. Refusing does not block the game or account.`]),
    S('3. Managing your choice', ['The banner offers reject, customise and accept choices at the same level. The choice is stored locally and is requested again after about 183 days or when a new consent version requires it. It can be changed at any time from “Cookies”.']),
    S('4. Advertising', ['Google AdSense is not active in the launch version. Advertising signals remain denied in this layer until a compliant advertising setup is enabled.']),
    S('5. Deletion', ['Browser website-data controls can remove preferences, local saves and the session cookie. Removing the session cookie signs the account out on that device.']),
  ]),

  CREDITS: D('CREDITS', 'Licences and credits', 'Main licences and attributions used by CLU', [
    S('OpenStreetMap & Protomaps', ['Real map backgrounds rely in particular on OpenStreetMap data under the Open Data Commons Open Database License (ODbL). Attribution: © OpenStreetMap contributors. Applicable Protomaps / OpenStreetMap attribution must remain visible.']),
    S('MapLibre GL JS', ['CLU Métropole uses MapLibre GL JS for map rendering under the BSD 3-Clause licence. Applicable copyright notices and licence terms must be retained.']),
    S('PMTiles / Protomaps', ['The PMTiles format and related implementations are used for maps. Their applicable licences and attribution requirements must be retained.']),
    S('BULB / origin of the public CLU project', ['The public CLU project historically derives in part from BULB. Reused portions remain subject to their source licences and copyright notices.']),
    S('Dependencies, fonts, icons and audio', ['Each software dependency, font, icon, sound effect, audio track or other third-party resource remains subject to its own licence. Required credit and licence files must be retained.']),
  ]),
}

const DE: Pack = {
  LEGAL: D('LEGAL', 'Impressum', legalSubtitle('de'), [
    S('Herausgeber und Verantwortlicher', [`${CLU_COMMERCIAL.productName} und der CLU-Dienst werden von ${seller.sellerName} unter dem Namen CLU als natürliche Person herausgegeben.`, `Kontaktanschrift: ${seller.address}. E-Mail: ${seller.email}. Telefon: ${seller.phone}. Verantwortlich für die Veröffentlichung: ${seller.sellerName}.`, 'In dieser Fassung wird keine Register- oder Umsatzsteuer-Identifikationsnummer angegeben, da CLU keine solche Nummer zur Veröffentlichung mitgeteilt wurde.']),
    S('Hosting und Infrastruktur', [`Die Website wird über ${seller.hostName} veröffentlicht. Für die europäische GitHub-Gesellschaft angegebene Anschrift: ${seller.hostAddress}. Kontakt: ${seller.hostContact}.`, `${seller.infrastructureName} stellt insbesondere ${localizedInfrastructureDescription('de')} bereit.`]),
    S('Kontakt', [`Fragen zu CLU, Konten, Zahlungen, Datenschutz oder Betroffenenrechten können an ${seller.email} gesendet werden.`]),
    S('Geistiges Eigentum', ['CLU-spezifischer Code, Texte, Benutzeroberfläche, visuelle Identität, Spielsysteme, Originalgrafiken, Musik und eigene Inhalte sind, soweit nicht anders angegeben, geschützt. Drittmaterial bleibt seinen jeweiligen Lizenzen unterworfen.']),
  ]),
  TERMS: D('TERMS', 'Nutzungsbedingungen', legalSubtitle('de'), [
    S('1. Geltung und Zustimmung', ['Diese Bedingungen gelten für CLU Métropole, CLU-Konten, Online-Funktionen und verbundene Dienste. Für die Kontoerstellung ist die Zustimmung zur aktuellen Fassung erforderlich.', 'CLU-Konten sind Personen ab 18 Jahren vorbehalten.']),
    S('2. CLU-Konto', ['Ein CLU-Konto wird durch einen Benutzernamen identifiziert. Passwort und optionale Google-Anmeldung können verwendet werden. Zugangsdaten und Wiederherstellungscode sind vertraulich zu behandeln.', 'Verkauf, Weitergabe oder Übertragung eines CLU-Kontos an Dritte sind untersagt.']),
    S('3. Benutzername', ['Der Benutzername kann in Online-Funktionen für andere Teilnehmer sichtbar sein und höchstens einmal alle 15 Tage geändert werden.', 'Missbräuchliche, irreführende, rechtswidrige oder identitätsvortäuschende Namen können abgelehnt oder geändert werden.']),
    S('4. Zulässige Nutzung und Sicherheit', ['Zugriffskontrollen dürfen nicht umgangen, der Dienst nicht gestört, Schwachstellen nicht missbraucht, missbräuchliche Automatisierungen oder Zahlungsbetrug nicht durchgeführt und fremde Daten nicht unbefugt abgerufen werden.', 'CLU kann bei Betrug, Angriffen, Missbrauch oder unbefugten Zugriffsversuchen Konten einschränken, sperren oder schließen.']),
    S('5. Partien, Spielstände und Inhalte', ['Lokale Spielstände bleiben auf dem Gerät, sofern sie nicht exportiert oder online genutzt werden. Online-Partien können Benutzername, ID, Berechtigungen, Aktionen, Spielstand und technische Wiederherstellungssnapshots verarbeiten.', 'CLU beansprucht kein Eigentum an originären Spielerkreationen und erhält nur die technischen Rechte für Hosting, Synchronisierung, Export und Übertragung.']),
    S('6. Verfügbarkeit und Löschung', ['Wartung, Sicherheitsupdates oder Störungen können den Dienst zeitweise unterbrechen. Bei einer erheblichen Premium-Störung kann CLU die Premium-Dauer verlängern.', 'Bei Kontolöschung werden Sitzungen und Anmeldemethoden entfernt; notwendige Zahlungs- oder Rechtsnachweise können anonymisiert aufbewahrt werden. Premium endet und ist nicht übertragbar.']),
    S('7. Zwingende Rechte', [`Zwingende Verbraucherrechte bleiben unberührt. Fragen oder Beschwerden: ${seller.email}.`]),
  ]),
  PREMIUM: D('PREMIUM', 'CLU-Premium-Bedingungen', premiumSubtitle('de'), [
    S('1. Angebot und Preis', [`${premium.productName} kostet ${LOCALIZED_LEGAL_META.de.priceLabel} für einen Monat. Es handelt sich um eine Einmalzahlung ohne automatische Verlängerung oder wiederkehrende Abbuchung durch CLU.`, 'BETA-Startangebot: Für Premium-Käufe, die vom 3. Oktober bis einschließlich 2. November 2026 bestätigt werden, gewährt CLU ohne Aufpreis einen zusätzlichen Premium-Monat, also insgesamt zwei Monate für 3,99 €.' ]),
    S('2. Aktivierung und Dauer', ['Premium wird nach Zahlungsbestätigung durch Stripe aktiviert. Ist das Konto nicht Premium, beginnt der Monat sofort.', 'Bei bereits aktivem Premium wird die durch den Kauf gewährte Dauer an das bestehende Ablaufdatum angehängt. Während des BETA-Startangebots beträgt sie insgesamt zwei Monate, außerhalb des Angebots einen Monat. Danach wird das Konto automatisch wieder kostenlos.']),
    S('3. Vorteile', ['Während Premium aktiv ist, kann das Konto:'], ['eine CLU-Onlinepartie erstellen und hosten;', 'CLU Desktop mit Internetverbindung zur Prüfung des Premium-Status nutzen;', 'die Entwicklung und den Betrieb von CLU unterstützen.']),
    S('4. Zahlung', ['Stripe verarbeitet die Zahlung. CLU speichert weder vollständige Kartennummer noch Kartenprüfnummer. CLU speichert technische Zahlungsreferenzen, Betrag, Währung, relevante Daten und die gewährte Premium-Dauer.']),
    S('5. Sofortige Aktivierung und Widerruf', ['Vor der Weiterleitung an Stripe verlangt der Nutzer ausdrücklich die sofortige Aktivierung nach Zahlungsbestätigung.', `Zwingende gesetzliche Rechte bleiben unberührt. Widerrufs- und Erstattungsanfragen können an ${seller.email} gesendet werden.`]),
    S('6. Erstattungen und Störungen', ['Doppelzahlungen, nicht aktiviertes Premium oder nachweisbare technische Probleme können erstattet werden. Eine vollständige Erstattung kann die entsprechende Premium-Zeit entfernen. Bei erheblichen CLU-Störungen kann Premium verlängert werden.']),
    S('7. Konto und Beschwerden', [`Premium ist an das kaufende Konto gebunden und grundsätzlich nicht übertragbar. Beschwerden: ${seller.email}.`]),
  ]),
  PRIVACY: D('PRIVACY', 'Datenschutzerklärung', legalSubtitle('de'), [
    S('1. Verantwortlicher', [`Verantwortlicher ist ${seller.sellerName}, CLU. Kontakt: ${seller.email}. Anschrift: ${seller.address}.`]),
    S('2. Kontodaten', ['CLU kann interne Konto-ID, Benutzername, normalisierte Form, Kontozeitpunkte, Kostenlos/Premium-Status, Premium-Ablauf und Datum der letzten Namensänderung verarbeiten.', 'Passwort und Wiederherstellungscode werden nur als kryptografische Hashes gespeichert. Bei Google-Verknüpfung wird nur die für die Verknüpfung notwendige stabile Google-ID gespeichert; die Google-E-Mail wird nicht absichtlich in der Kontodatenbank gespeichert.', 'Sitzungen enthalten technische Kennungen sowie Erstellungs-, Ablauf- und letzte Nutzungszeitpunkte.']),
    S('3. Zahlungen und Rechtsnachweise', ['Stripe verarbeitet Kartendaten, Namen und E-Mail in seiner Oberfläche. CLU erhält weder die vollständige Kartennummer noch die Prüfnummer.', 'CLU speichert Stripe-Referenzen, Betrag, Währung, Daten, ggf. Erstattungsinformationen, Premium-Zeiträume und Nachweise über akzeptierte Rechtsdokumente.']),
    S('4. Lokale und Online-Spieldaten', ['Einstellungen, Sprache, Tutorial, Datenschutzwahl und lokale Spielstände können in localStorage oder IndexedDB gespeichert werden.', 'Online-Partien können Benutzername, ID, erstellte/beigetretene Partien, Berechtigungen, Aktionen, synchronisierten Zustand und Wiederherstellungssnapshots verarbeiten. Während einer aktiven Online-Sitzung kann ein temporäres Wiederverbindungstoken in sessionStorage gespeichert werden; es wird beim Verlassen, Schließen oder Ablaufen der Sitzung gelöscht. CLU nutzt Spielerkreationen nicht als kommerzielle Inhaltsdatenbank.']),
    S('5. Technik, Support und Analytics', [`Technische Anbieter können IP-Adresse, Browserdaten, Netzwerkheader und Sicherheitsprotokolle verarbeiten. Support über ${seller.email} läuft über Google/Gmail. Google Analytics (${analyticsId}) wird nur nach Einwilligung geladen. AdSense ist zum Start nicht aktiv.`]),
    S('6. Zwecke und Empfänger', ['Daten dienen Kontoerstellung und -sicherheit, Authentifizierung, Spielbetrieb, Online-Partien, Premium, Zahlungen, Support, Missbrauchsprävention und – mit Einwilligung – Reichweitenmessung.', 'GitHub hostet die statische Website, Cloudflare stellt API/D1/R2/Karten/Netzwerk bereit, Stripe Zahlungen und Google Anmeldung/Analytics/Gmail. CLU verkauft keine personenbezogenen Daten an Werbetreibende.']),
    S('7. Aufbewahrung', ['Sitzungen laufen normalerweise nach 30 Tagen ab. Gewöhnliche CLU-Diagnosedaten sollen nach etwa 30 Tagen gelöscht werden; sicherheitsrelevante Informationen können bis zu 90 Tage aufbewahrt werden.', 'Wenn eine Online-Partie geschlossen wird, werden ihr aktiver Sitzungszustand und ihre technischen Snapshots aus der Spielinfrastruktur gelöscht. Nach Kontolöschung werden Zugangsmittel entfernt und das Konto anonymisiert; Zahlungs- und Rechtsnachweise können für erforderliche gesetzliche Zeiträume verbleiben.']),
    S('8. Rechte', [`Nutzer können Daten exportieren, Berichtigung verlangen, ihr Konto löschen und gesetzliche Rechte ausüben. Der Benutzername kann alle 15 Tage geändert werden; Analytics-Einwilligung kann unter „Cookies“ widerrufen werden. Kontakt: ${seller.email}.`]),
  ]),
  COOKIES: D('COOKIES', 'Cookie- und lokale Speicher-Richtlinie', legalSubtitle('de'), [
    S('1. Erforderliche Speicherung', ['CLU nutzt notwendige Speicherung für Einstellungen, Sprache, Tutorial, Datenschutzwahl und lokale Spielstände. IndexedDB dient u. a. Spielständen, localStorage u. a. Einstellungen. Bei Anmeldung wird ein notwendiges HttpOnly-, Secure- und SameSite=Lax-Sitzungscookie genutzt, normalerweise 30 Tage.']),
    S('2. Google Analytics — optional', [`Google Analytics (${analyticsId}) wird nur nach Zustimmung zur Reichweitenmessung geladen. Ablehnung blockiert Spiel oder Konto nicht.`]),
    S('3. Auswahl verwalten', ['Ablehnen, Anpassen und Akzeptieren werden gleichwertig angeboten. Die Auswahl wird lokal gespeichert und nach etwa 183 Tagen oder bei einer neuen Einwilligungsversion erneut abgefragt.']),
    S('4. Werbung', ['Google AdSense ist zum Start nicht aktiv. Werbesignale bleiben in dieser Schicht abgelehnt, bis eine konforme Werbekonfiguration aktiviert wird.']),
    S('5. Löschen', ['Browserfunktionen zum Löschen von Website-Daten können Einstellungen, lokale Spielstände und das Sitzungscookie entfernen.']),
  ]),
  CREDITS: D('CREDITS', 'Lizenzen und Credits', 'Wichtigste von CLU verwendete Lizenzen und Quellenangaben', [
    S('OpenStreetMap & Protomaps', ['Reale Karten beruhen u. a. auf OpenStreetMap-Daten unter ODbL. Quellenangabe: © OpenStreetMap contributors; erforderliche Protomaps-/OSM-Hinweise müssen sichtbar bleiben.']),
    S('MapLibre GL JS', ['CLU Métropole nutzt MapLibre GL JS unter BSD-3-Clause. Copyright- und Lizenzhinweise sind beizubehalten.']),
    S('PMTiles / Protomaps', ['PMTiles und zugehörige Implementierungen bleiben ihren jeweiligen Lizenzen und Quellenangaben unterworfen.']),
    S('BULB / Ursprung des öffentlichen CLU-Projekts', ['Das öffentliche CLU-Projekt ist historisch teilweise aus BULB hervorgegangen; wiederverwendete Teile behalten ihre ursprünglichen Lizenzpflichten.']),
    S('Abhängigkeiten, Schriften, Icons und Audio', ['Jede Drittressource bleibt ihrer eigenen Lizenz unterworfen; erforderliche Credits und Lizenzdateien sind beizubehalten.']),
  ]),
}

const NL: Pack = {
  LEGAL: D('LEGAL', 'Juridische informatie', legalSubtitle('nl'), [
    S('Uitgever en publicatieverantwoordelijke', [`${CLU_COMMERCIAL.productName} en de CLU-dienst worden uitgegeven door ${seller.sellerName}, onder de naam CLU, als natuurlijke persoon.`, `Contactadres: ${seller.address}. E-mail: ${seller.email}. Telefoon: ${seller.phone}. Publicatieverantwoordelijke: ${seller.sellerName}.`, 'In deze versie wordt geen inschrijvings- of btw-nummer vermeld omdat CLU geen nummer heeft ontvangen om te publiceren.']),
    S('Hosting en infrastructuur', [`De website wordt gepubliceerd via ${seller.hostName}. Vermeld adres van de Europese GitHub-entiteit: ${seller.hostAddress}. Contact: ${seller.hostContact}.`, `${seller.infrastructureName} levert onder meer ${localizedInfrastructureDescription('nl')}.`]),
    S('Contact', [`Vragen over CLU, accounts, betalingen, privacy of persoonsgegevens kunnen naar ${seller.email}.`]),
    S('Intellectuele eigendom', ['CLU-specifieke code, teksten, interface, visuele identiteit, spelsystemen, originele beelden, muziek en eigen inhoud zijn beschermd voor zover niet anders vermeld. Materialen van derden blijven onder hun eigen licenties vallen.']),
  ]),
  TERMS: D('TERMS', 'Gebruiksvoorwaarden', legalSubtitle('nl'), [
    S('1. Toepassing en aanvaarding', ['Deze voorwaarden gelden voor CLU Métropole, CLU-accounts, onlinefuncties en bijbehorende diensten. Voor het aanmaken van een account is aanvaarding van de actuele versie vereist.', 'CLU-accounts zijn voorbehouden aan personen van 18 jaar of ouder.']),
    S('2. CLU-account', ['Een CLU-account wordt geïdentificeerd door een gebruikersnaam. Een wachtwoord en optioneel Google-aanmelden kunnen worden gebruikt. Aanmeldgegevens en herstelcode moeten vertrouwelijk blijven.', 'Verkoop, delen of overdracht van een CLU-account aan een derde is verboden.']),
    S('3. Gebruikersnaam', ['De gebruikersnaam kan zichtbaar zijn voor andere deelnemers online en kan maximaal eenmaal per 15 dagen worden gewijzigd.', 'Misleidende, beledigende, onwettige of imiterende namen kunnen worden geweigerd of aangepast.']),
    S('4. Toegestaan gebruik en veiligheid', ['Het omzeilen van toegangscontroles, verstoren van de dienst, misbruiken van kwetsbaarheden, frauduleuze betalingen, misbruikautomatisering of ongeoorloofde toegang tot andermans gegevens is verboden.', 'CLU kan accounts beperken, schorsen of sluiten bij fraude, aanvallen, misbruik of ongeoorloofde toegangspogingen.']),
    S('5. Partijen, saves en spelersinhoud', ['Lokale saves blijven op het apparaat tenzij ze worden geëxporteerd of online gebruikt. Onlinepartijen kunnen gebruikersnaam, ID, rechten, acties, spelstatus en herstelsnapshots verwerken.', 'CLU claimt geen eigendom over originele creaties van spelers en krijgt alleen de technische rechten die nodig zijn voor hosting, synchronisatie, export en overdracht.']),
    S('6. Beschikbaarheid en verwijdering', ['Onderhoud, beveiligingsupdates of incidenten kunnen de dienst tijdelijk onderbreken. Bij een ernstige Premium-storing kan CLU de Premium-duur verlengen.', 'Bij accountverwijdering worden sessies en aanmeldmethoden verwijderd. Noodzakelijke betalings- of juridische bewijzen kunnen geanonimiseerd worden bewaard. Premium eindigt en is niet overdraagbaar.']),
    S('7. Dwingende rechten', [`Dwingende consumentenrechten blijven gelden. Vragen of klachten: ${seller.email}.`]),
  ]),
  PREMIUM: D('PREMIUM', 'Voorwaarden CLU Premium', premiumSubtitle('nl'), [
    S('1. Aanbod en prijs', [`${premium.productName} kost ${LOCALIZED_LEGAL_META.nl.priceLabel} voor één maand. Het is een eenmalige betaling zonder automatische verlenging of terugkerende afschrijving door CLU.`, 'BETA-lanceringsaanbod: Premium-aankopen die van 3 oktober tot en met 2 november 2026 worden bevestigd krijgen zonder extra kosten één extra Premium-maand, dus in totaal twee maanden voor € 3,99.']),
    S('2. Activering en duur', ['Premium wordt geactiveerd nadat Stripe de betaling bevestigt. Als het account niet Premium is, start de maand onmiddellijk.', 'Als Premium al actief is, wordt de door de aankoop toegekende duur aan de bestaande vervaldatum toegevoegd. Tijdens het BETA-lanceringsaanbod is dat in totaal twee maanden; buiten de aanbieding één maand. Daarna wordt het account automatisch weer Gratis.']),
    S('3. Voordelen', ['Zolang Premium actief is kan het account:'], ['een online CLU-partij maken en hosten;', 'CLU Desktop gebruiken met internetverbinding voor Premium-controle;', 'de ontwikkeling en werking van CLU ondersteunen.']),
    S('4. Betaling', ['Stripe verwerkt betalingen. CLU bewaart niet het volledige kaartnummer of de beveiligingscode. CLU bewaart technische betalingsreferenties, bedrag, valuta, relevante data en de toegekende Premium-periode.']),
    S('5. Onmiddellijke activering en herroeping', ['Voor de doorverwijzing naar Stripe vraagt de gebruiker uitdrukkelijk om onmiddellijke activering na betalingsbevestiging.', `Dwingende wettelijke rechten blijven gelden. Verzoeken om herroeping of terugbetaling kunnen naar ${seller.email}.`]),
    S('6. Terugbetalingen en incidenten', ['Dubbele betalingen, niet geactiveerde Premium of aantoonbare technische problemen kunnen worden terugbetaald. Een volledige terugbetaling kan de overeenkomstige Premium-periode verwijderen. Een ernstige CLU-storing kan tot verlenging leiden.']),
    S('7. Account en klachten', [`Premium is gekoppeld aan het betalende account en is in principe niet overdraagbaar. Klachten: ${seller.email}.`]),
  ]),
  PRIVACY: D('PRIVACY', 'Privacybeleid', legalSubtitle('nl'), [
    S('1. Verantwoordelijke', [`De verwerkingsverantwoordelijke is ${seller.sellerName}, CLU. Contact: ${seller.email}. Adres: ${seller.address}.`]),
    S('2. Accountgegevens', ['CLU kan intern account-ID, gebruikersnaam, genormaliseerde vorm, accountdatums, Gratis/Premium-status, Premium-vervaldatum en datum van de laatste naamswijziging verwerken.', 'Wachtwoorden en herstelcodes worden alleen als cryptografische hashes opgeslagen. Bij Google-koppeling wordt alleen de stabiele Google-ID voor die koppeling bewaard; het Google-e-mailadres wordt niet bewust in de accountdatabase opgeslagen.', 'Sessies bevatten technische identifiers en datums voor creatie, verloop en laatste gebruik.']),
    S('3. Betalingen en juridische bewijzen', ['Stripe verwerkt kaartgegevens, naam en e-mail in zijn betaalinterface. CLU ontvangt niet het volledige kaartnummer of de beveiligingscode.', 'CLU bewaart Stripe-referenties, bedrag, valuta, datums, eventuele terugbetalingsinformatie, Premium-periodes en registraties van aanvaarde juridische documenten.']),
    S('4. Lokale en online spelgegevens', ['Instellingen, taal, tutorial, privacykeuze en lokale saves kunnen in localStorage of IndexedDB worden bewaard.', 'Onlinepartijen kunnen gebruikersnaam, ID, aangemaakte/deelgenomen partijen, rechten, acties, gesynchroniseerde spelstatus en herstelsnapshots verwerken. Tijdens een actieve online-sessie kan tijdelijk een herstel-token in sessionStorage worden opgeslagen; dit wordt verwijderd wanneer de sessie wordt verlaten, gesloten of verloopt. CLU gebruikt spelerscreaties niet als commerciële inhoudsbank.']),
    S('5. Techniek, support en analytics', [`Technische aanbieders kunnen IP-adres, browserinformatie, netwerkheaders en beveiligingslogs verwerken. Support via ${seller.email} loopt via Google/Gmail. Google Analytics (${analyticsId}) wordt alleen na toestemming geladen. AdSense is bij de lancering niet actief.`]),
    S('6. Doeleinden en ontvangers', ['Gegevens worden gebruikt voor accountbeheer, authenticatie, spel en onlinepartijen, Premium, betalingen, support, fraudepreventie en – met toestemming – publieksmeting.', 'GitHub host de statische website; Cloudflare levert API/D1/R2/kaarten/netwerk; Stripe betalingen en Google aanmelding/Analytics/Gmail. CLU verkoopt geen persoonsgegevens aan adverteerders.']),
    S('7. Bewaartermijnen', ['Sessies verlopen normaal na 30 dagen. Gewone CLU-diagnosegegevens zijn bedoeld voor verwijdering na ongeveer 30 dagen; beveiligingsinformatie kan tot 90 dagen worden bewaard.', 'Wanneer een onlinepartij wordt gesloten, worden de actieve sessiestatus en technische snapshots uit de spelinfrastructuur verwijderd. Na accountverwijdering worden aanmeldmiddelen verwijderd en het account geanonimiseerd; betalings- en juridische bewijzen kunnen zolang blijven als toepasselijke verplichtingen vereisen.']),
    S('8. Rechten', [`Gebruikers kunnen hun gegevens exporteren, rectificatie vragen, hun account verwijderen en wettelijke rechten uitoefenen. De gebruikersnaam kan eenmaal per 15 dagen veranderen; Analytics-toestemming kan via “Cookies” worden ingetrokken. Contact: ${seller.email}.`]),
  ]),
  COOKIES: D('COOKIES', 'Cookie- en lokaal-opslagbeleid', legalSubtitle('nl'), [
    S('1. Noodzakelijke opslag', ['CLU gebruikt noodzakelijke opslag voor voorkeuren, taal, tutorial, privacykeuze en lokale saves. IndexedDB wordt o.a. voor saves gebruikt en localStorage o.a. voor voorkeuren. Bij aanmelden wordt een noodzakelijk HttpOnly-, Secure- en SameSite=Lax-sessiecooky gebruikt, normaal 30 dagen.']),
    S('2. Google Analytics — optioneel', [`Google Analytics (${analyticsId}) wordt alleen na toestemming voor publieksmeting geladen. Weigeren blokkeert spel of account niet.`]),
    S('3. Keuze beheren', ['Weigeren, aanpassen en accepteren worden gelijkwaardig aangeboden. De keuze wordt lokaal bewaard en na ongeveer 183 dagen of bij een nieuwe toestemmingsversie opnieuw gevraagd.']),
    S('4. Reclame', ['Google AdSense is bij de lancering niet actief. Advertentiesignalen blijven in deze laag geweigerd totdat een conforme reclameconfiguratie wordt ingeschakeld.']),
    S('5. Verwijderen', ['Browserinstellingen voor websitegegevens kunnen voorkeuren, lokale saves en het sessiecooky verwijderen.']),
  ]),
  CREDITS: D('CREDITS', 'Licenties en credits', 'Belangrijkste licenties en bronvermeldingen van CLU', [
    S('OpenStreetMap & Protomaps', ['Echte kaarten steunen o.a. op OpenStreetMap-data onder ODbL. Vermelding: © OpenStreetMap contributors; toepasselijke Protomaps-/OSM-vermeldingen moeten zichtbaar blijven.']),
    S('MapLibre GL JS', ['CLU Métropole gebruikt MapLibre GL JS onder BSD 3-Clause. Auteursrecht- en licentievermeldingen moeten behouden blijven.']),
    S('PMTiles / Protomaps', ['PMTiles en bijbehorende implementaties blijven onder hun eigen licenties en vermeldingsvereisten vallen.']),
    S('BULB / oorsprong van het publieke CLU-project', ['Het publieke CLU-project komt historisch deels voort uit BULB; hergebruikte delen behouden hun oorspronkelijke licentieverplichtingen.']),
    S('Afhankelijkheden, lettertypen, iconen en audio', ['Elke derde-partijbron blijft onder haar eigen licentie vallen; vereiste credits en licentiebestanden moeten behouden blijven.']),
  ]),
}

const ES: Pack = {
  LEGAL: D('LEGAL', 'Aviso legal', legalSubtitle('es'), [
    S('Editor y responsable de publicación', [`${CLU_COMMERCIAL.productName} y el servicio CLU son editados por ${seller.sellerName}, bajo el nombre CLU, como persona física.`, `Dirección de contacto: ${seller.address}. Email: ${seller.email}. Teléfono: ${seller.phone}. Responsable de publicación: ${seller.sellerName}.`, 'Esta versión no indica número de registro empresarial ni de IVA porque CLU no ha recibido ninguno para su publicación.']),
    S('Alojamiento e infraestructura', [`El sitio se publica mediante ${seller.hostName}. Dirección indicada para la entidad europea de GitHub: ${seller.hostAddress}. Contacto: ${seller.hostContact}.`, `${seller.infrastructureName} proporciona, entre otros, ${localizedInfrastructureDescription('es')}.`]),
    S('Contacto', [`Las preguntas sobre CLU, cuentas, pagos, privacidad o derechos sobre datos pueden enviarse a ${seller.email}.`]),
    S('Propiedad intelectual', ['Salvo indicación contraria, el código, textos, interfaz, identidad visual, sistemas de juego, gráficos originales, música y contenidos propios de CLU están protegidos. Los elementos de terceros conservan sus licencias.']),
  ]),
  TERMS: D('TERMS', 'Condiciones de uso', legalSubtitle('es'), [
    S('1. Objeto y aceptación', ['Estas condiciones regulan CLU Métropole, las cuentas CLU, las funciones en línea y los servicios asociados. Crear una cuenta requiere aceptar la versión vigente.', 'Las cuentas CLU están reservadas a personas de 18 años o más.']),
    S('2. Cuenta CLU', ['La cuenta se identifica mediante un seudónimo. Puede usarse contraseña y, cuando esté disponible, inicio de sesión opcional con Google. Las credenciales y el código de recuperación deben mantenerse confidenciales.', 'Está prohibido vender, compartir o transferir una cuenta CLU a otra persona.']),
    S('3. Seudónimo', ['El seudónimo puede ser visible para otros participantes en línea y puede cambiarse como máximo una vez cada 15 días.', 'CLU puede rechazar o modificar nombres abusivos, engañosos, ilícitos o que suplanten a terceros.']),
    S('4. Uso permitido y seguridad', ['Se prohíbe eludir controles de acceso, perturbar el servicio, explotar vulnerabilidades, automatizar solicitudes abusivas, cometer fraude de pago o acceder sin autorización a datos ajenos.', 'CLU puede limitar, suspender o cerrar cuentas por fraude, ataques, abusos o intentos de acceso no autorizado.']),
    S('5. Partidas, guardados y contenido', ['Los guardados locales permanecen en el dispositivo salvo exportación o uso en línea. Las partidas en línea pueden tratar seudónimo, ID, permisos, acciones, estado y snapshots técnicos.', 'CLU no reclama la propiedad de las creaciones originales de los jugadores y solo recibe los derechos técnicos necesarios para alojar, sincronizar, exportar y transmitir la partida.']),
    S('6. Disponibilidad y eliminación', ['El mantenimiento, las actualizaciones de seguridad o los incidentes pueden interrumpir temporalmente el servicio. Una incidencia Premium importante puede dar lugar a una ampliación del Premium.', 'Al borrar la cuenta se cierran sesiones y se eliminan métodos de acceso; las pruebas de pago o jurídicas necesarias pueden conservarse anonimizadas. Premium termina y no es transferible.']),
    S('7. Derechos imperativos', [`Los derechos imperativos del consumidor se mantienen. Preguntas o reclamaciones: ${seller.email}.`]),
  ]),
  PREMIUM: D('PREMIUM', 'Condiciones CLU Premium', premiumSubtitle('es'), [
    S('1. Oferta y precio', [`${premium.productName} cuesta ${LOCALIZED_LEGAL_META.es.priceLabel} por un mes. Es un pago único, sin renovación automática ni cobro recurrente por CLU.`, 'Oferta de lanzamiento BETA: las compras Premium confirmadas del 3 de octubre al 2 de noviembre de 2026 inclusive reciben un mes Premium adicional sin coste, es decir, dos meses en total por 3,99 €.']),
    S('2. Activación y duración', ['Premium se activa cuando Stripe confirma el pago. Si la cuenta no es Premium, el mes empieza inmediatamente.', 'Si Premium ya está activo, la duración concedida por la compra se añade a la fecha de caducidad existente. Durante la oferta de lanzamiento BETA se conceden dos meses en total; fuera de la oferta, un mes. Al caducar, la cuenta vuelve automáticamente a Gratuita.']),
    S('3. Ventajas', ['Mientras Premium esté activo, la cuenta puede:'], ['crear y alojar una partida CLU en línea;', 'acceder a CLU Desktop con conexión a Internet para verificar Premium;', 'apoyar el desarrollo y funcionamiento de CLU.']),
    S('4. Pago', ['Stripe procesa los pagos. CLU no almacena el número completo de tarjeta ni el código de seguridad. CLU conserva referencias técnicas, importe, moneda, fechas y periodo Premium otorgado.']),
    S('5. Activación inmediata y desistimiento', ['Antes de ir a Stripe, el usuario solicita expresamente la activación inmediata tras la confirmación del pago.', `Los derechos legales imperativos se mantienen. Las solicitudes de desistimiento o reembolso pueden enviarse a ${seller.email}.`]),
    S('6. Reembolsos e incidencias', ['Los pagos duplicados, Premium no activado u otros problemas técnicos verificables pueden ser reembolsados. Un reembolso total puede retirar el periodo Premium correspondiente. Una incidencia grave de CLU puede generar una ampliación.']),
    S('7. Cuenta y reclamaciones', [`Premium queda vinculado a la cuenta compradora y, en principio, no es transferible. Reclamaciones: ${seller.email}.`]),
  ]),
  PRIVACY: D('PRIVACY', 'Política de privacidad', legalSubtitle('es'), [
    S('1. Responsable', [`El responsable es ${seller.sellerName}, CLU. Contacto: ${seller.email}. Dirección: ${seller.address}.`]),
    S('2. Datos de cuenta', ['CLU puede tratar ID interno, seudónimo y forma normalizada, fechas de cuenta, estado Gratuito/Premium, caducidad Premium y fecha del último cambio de seudónimo.', 'Las contraseñas y códigos de recuperación solo se almacenan como hashes criptográficos. Al vincular Google se conserva únicamente el identificador estable necesario; no se intenta guardar el email de Google en la base de cuentas.', 'Las sesiones contienen identificadores técnicos y fechas de creación, caducidad y último uso.']),
    S('3. Pagos y pruebas jurídicas', ['Stripe trata datos de tarjeta, nombre y email en su interfaz. CLU no recibe el número completo de tarjeta ni el código de seguridad.', 'CLU conserva referencias Stripe, importe, moneda, fechas, posibles datos de reembolso, periodos Premium y registros de aceptación de documentos jurídicos.']),
    S('4. Datos locales y partidas en línea', ['Ajustes, idioma, tutorial, elección de privacidad y guardados locales pueden almacenarse en localStorage o IndexedDB.', 'Las partidas en línea pueden tratar seudónimo, ID, partidas creadas o unidas, permisos, acciones, estado sincronizado y snapshots de recuperación. Durante una sesión en línea activa puede guardarse temporalmente en sessionStorage un token de reconexión; se elimina al salir, cerrar o caducar la sesión. CLU no reutiliza las creaciones de jugadores como banco comercial de contenidos.']),
    S('5. Técnica, soporte y Analytics', [`Los proveedores técnicos pueden tratar IP, navegador, cabeceras de red y logs de seguridad. El soporte por ${seller.email} usa Google/Gmail. Google Analytics (${analyticsId}) solo se carga con consentimiento. AdSense no está activo en el lanzamiento.`]),
    S('6. Finalidades y destinatarios', ['Los datos se usan para cuentas, autenticación, juego, partidas en línea, Premium, pagos, soporte, prevención del fraude y, con consentimiento, medición de audiencia.', 'GitHub aloja el sitio estático; Cloudflare proporciona API/D1/R2/mapas/red; Stripe pagos y Google acceso/Analytics/Gmail. CLU no vende datos personales a anunciantes.']),
    S('7. Conservación', ['Las sesiones caducan normalmente a los 30 días. Los datos ordinarios de diagnóstico de CLU se eliminan aproximadamente a los 30 días; datos de seguridad pueden conservarse hasta 90 días.', 'Cuando se cierra una partida en línea, su estado de sesión activo y sus snapshots técnicos se eliminan de la infraestructura de la partida. Tras borrar una cuenta se eliminan los medios de acceso y se anonimiza; pagos y pruebas jurídicas pueden conservarse durante el plazo exigido por obligaciones aplicables.']),
    S('8. Derechos', [`El usuario puede exportar datos, pedir rectificación, borrar su cuenta y ejercer derechos legales. El seudónimo puede cambiarse cada 15 días y el consentimiento Analytics puede retirarse en “Cookies”. Contacto: ${seller.email}.`]),
  ]),
  COOKIES: D('COOKIES', 'Política de cookies y almacenamiento local', legalSubtitle('es'), [
    S('1. Almacenamientos necesarios', ['CLU usa almacenamiento necesario para preferencias, idioma, tutorial, privacidad y guardados locales. IndexedDB se usa, entre otros, para guardados y localStorage para preferencias. Al iniciar sesión se usa una cookie necesaria HttpOnly, Secure y SameSite=Lax, normalmente durante 30 días.']),
    S('2. Google Analytics — opcional', [`Google Analytics (${analyticsId}) solo se carga tras aceptar la medición de audiencia. Rechazarlo no bloquea juego ni cuenta.`]),
    S('3. Gestión de la elección', ['Rechazar, personalizar y aceptar se ofrecen al mismo nivel. La elección se guarda localmente y se vuelve a solicitar tras unos 183 días o una nueva versión de consentimiento.']),
    S('4. Publicidad', ['Google AdSense no está activo en la versión de lanzamiento. Las señales publicitarias permanecen rechazadas hasta activar una configuración conforme.']),
    S('5. Eliminación', ['Los controles del navegador para datos del sitio pueden borrar preferencias, guardados locales y la cookie de sesión.']),
  ]),
  CREDITS: D('CREDITS', 'Licencias y créditos', 'Principales licencias y atribuciones utilizadas por CLU', [
    S('OpenStreetMap & Protomaps', ['Los mapas reales se basan, entre otros, en datos OpenStreetMap bajo ODbL. Atribución: © OpenStreetMap contributors; deben mantenerse las atribuciones Protomaps/OSM aplicables.']),
    S('MapLibre GL JS', ['CLU Métropole usa MapLibre GL JS bajo licencia BSD 3-Clause. Deben conservarse los avisos de copyright y licencia.']),
    S('PMTiles / Protomaps', ['PMTiles y sus implementaciones siguen sujetos a sus licencias y requisitos de atribución.']),
    S('BULB / origen del proyecto público CLU', ['El proyecto público CLU deriva históricamente en parte de BULB; las partes reutilizadas conservan sus obligaciones de licencia originales.']),
    S('Dependencias, fuentes, iconos y audio', ['Cada recurso de terceros conserva su licencia; deben mantenerse los créditos y archivos de licencia requeridos.']),
  ]),
}

const IT: Pack = {
  LEGAL: D('LEGAL', 'Note legali', legalSubtitle('it'), [
    S('Editore e responsabile della pubblicazione', [`${CLU_COMMERCIAL.productName} e il servizio CLU sono pubblicati da ${seller.sellerName}, con il nome CLU, come persona fisica.`, `Indirizzo di contatto: ${seller.address}. Email: ${seller.email}. Telefono: ${seller.phone}. Responsabile della pubblicazione: ${seller.sellerName}.`, 'In questa versione non è indicato alcun numero di registrazione o partita IVA perché CLU non ne ha ricevuto uno da pubblicare.']),
    S('Hosting e infrastruttura', [`Il sito è pubblicato tramite ${seller.hostName}. Indirizzo indicato per l’entità europea di GitHub: ${seller.hostAddress}. Contatto: ${seller.hostContact}.`, `${seller.infrastructureName} fornisce in particolare ${localizedInfrastructureDescription('it')}.`]),
    S('Contatto', [`Domande su CLU, account, pagamenti, privacy o diritti sui dati possono essere inviate a ${seller.email}.`]),
    S('Proprietà intellettuale', ['Salvo diversa indicazione, codice, testi, interfaccia, identità visiva, sistemi di gioco, grafica originale, musica e contenuti propri di CLU sono protetti. I materiali di terzi restano soggetti alle rispettive licenze.']),
  ]),
  TERMS: D('TERMS', 'Condizioni d’uso', legalSubtitle('it'), [
    S('1. Oggetto e accettazione', ['Le presenti condizioni regolano CLU Métropole, gli account CLU, le funzioni online e i servizi associati. La creazione di un account richiede l’accettazione della versione vigente.', 'Gli account CLU sono riservati a persone di almeno 18 anni.']),
    S('2. Account CLU', ['L’account è identificato da uno pseudonimo. Possono essere usati una password e, se disponibile, l’accesso Google opzionale. Credenziali e codice di recupero devono restare riservati.', 'È vietato vendere, condividere o trasferire un account CLU a terzi.']),
    S('3. Pseudonimo', ['Lo pseudonimo può essere visibile agli altri partecipanti online e può essere modificato al massimo una volta ogni 15 giorni.', 'CLU può rifiutare o modificare nomi abusivi, ingannevoli, illeciti o che impersonano terzi.']),
    S('4. Uso consentito e sicurezza', ['È vietato aggirare controlli di accesso, disturbare il servizio, sfruttare vulnerabilità, automatizzare richieste abusive, commettere frodi di pagamento o accedere senza autorizzazione ai dati altrui.', 'CLU può limitare, sospendere o chiudere account in caso di frode, attacchi, abusi o tentativi di accesso non autorizzato.']),
    S('5. Partite, salvataggi e contenuti', ['I salvataggi locali restano sul dispositivo salvo esportazione o uso online. Le partite online possono trattare pseudonimo, ID, permessi, azioni, stato e snapshot tecnici.', 'CLU non rivendica la proprietà delle creazioni originali dei giocatori e riceve solo i diritti tecnici necessari per hosting, sincronizzazione, esportazione e trasmissione.']),
    S('6. Disponibilità ed eliminazione', ['Manutenzione, aggiornamenti di sicurezza o incidenti possono interrompere temporaneamente il servizio. Un grave problema Premium può portare a una proroga.', 'Eliminando l’account vengono chiuse le sessioni e rimossi i metodi di accesso; prove di pagamento o legali necessarie possono essere conservate in forma anonimizzata. Premium termina e non è trasferibile.']),
    S('7. Diritti inderogabili', [`I diritti inderogabili dei consumatori restano validi. Domande o reclami: ${seller.email}.`]),
  ]),
  PREMIUM: D('PREMIUM', 'Condizioni CLU Premium', premiumSubtitle('it'), [
    S('1. Offerta e prezzo', [`${premium.productName} costa ${LOCALIZED_LEGAL_META.it.priceLabel} per un mese. È un pagamento singolo, senza rinnovo automatico né addebito ricorrente da parte di CLU.`, 'Offerta di lancio BETA: gli acquisti Premium confermati dal 3 ottobre al 2 novembre 2026 inclusi ricevono un mese Premium aggiuntivo senza costi, per un totale di due mesi a 3,99 €.']),
    S('2. Attivazione e durata', ['Premium viene attivato dopo la conferma del pagamento da parte di Stripe. Se l’account non è Premium, il mese inizia subito.', 'Se Premium è già attivo, la durata concessa dall’acquisto viene aggiunta alla scadenza esistente. Durante l’offerta di lancio BETA la durata totale concessa è di due mesi; fuori dall’offerta è di un mese. Alla scadenza l’account torna automaticamente Gratuito.']),
    S('3. Vantaggi', ['Durante Premium l’account può:'], ['creare e ospitare una partita CLU online;', 'accedere a CLU Desktop con connessione Internet per verificare Premium;', 'sostenere lo sviluppo e il funzionamento di CLU.']),
    S('4. Pagamento', ['Stripe gestisce i pagamenti. CLU non memorizza il numero completo della carta né il codice di sicurezza. CLU conserva riferimenti tecnici, importo, valuta, date e periodo Premium assegnato.']),
    S('5. Attivazione immediata e recesso', ['Prima del reindirizzamento a Stripe, l’utente richiede espressamente l’attivazione immediata dopo la conferma del pagamento.', `I diritti inderogabili restano validi. Richieste di recesso o rimborso: ${seller.email}.`]),
    S('6. Rimborsi e incidenti', ['Doppi pagamenti, Premium non attivato o problemi tecnici verificabili possono essere rimborsati. Un rimborso totale può rimuovere il periodo Premium corrispondente. Un grave disservizio CLU può comportare una proroga.']),
    S('7. Account e reclami', [`Premium è legato all’account che ha effettuato l’acquisto e in linea di principio non è trasferibile. Reclami: ${seller.email}.`]),
  ]),
  PRIVACY: D('PRIVACY', 'Informativa sulla privacy', legalSubtitle('it'), [
    S('1. Titolare', [`Il titolare è ${seller.sellerName}, CLU. Contatto: ${seller.email}. Indirizzo: ${seller.address}.`]),
    S('2. Dati dell’account', ['CLU può trattare ID interno, pseudonimo e forma normalizzata, date account, stato Gratuito/Premium, scadenza Premium e data dell’ultimo cambio pseudonimo.', 'Password e codici di recupero sono memorizzati solo come hash crittografici. Se Google è collegato, CLU conserva solo l’identificativo stabile necessario al collegamento e non cerca di memorizzare l’email Google nel database account.', 'Le sessioni contengono identificatori tecnici e date di creazione, scadenza e ultimo utilizzo.']),
    S('3. Pagamenti e prove legali', ['Stripe tratta dati della carta, nome ed email nella propria interfaccia. CLU non riceve il numero completo della carta né il codice di sicurezza.', 'CLU conserva riferimenti Stripe, importo, valuta, date, eventuali dati di rimborso, periodi Premium e registrazioni di accettazione dei documenti legali.']),
    S('4. Dati locali e partite online', ['Impostazioni, lingua, tutorial, scelta privacy e salvataggi locali possono essere archiviati in localStorage o IndexedDB.', 'Le partite online possono trattare pseudonimo, ID, partite create o raggiunte, permessi, azioni, stato sincronizzato e snapshot di recupero. Durante una sessione online attiva può essere conservato temporaneamente in sessionStorage un token di riconnessione; viene eliminato quando la sessione viene lasciata, chiusa o scade. CLU non riutilizza le creazioni dei giocatori come banca commerciale di contenuti.']),
    S('5. Tecnica, supporto e Analytics', [`I fornitori tecnici possono trattare IP, informazioni browser, header di rete e log di sicurezza. Il supporto via ${seller.email} usa Google/Gmail. Google Analytics (${analyticsId}) viene caricato solo con consenso. AdSense non è attivo al lancio.`]),
    S('6. Finalità e destinatari', ['I dati servono per account, autenticazione, gioco, partite online, Premium, pagamenti, supporto, prevenzione frodi e, con consenso, misurazione del pubblico.', 'GitHub ospita il sito statico; Cloudflare fornisce API/D1/R2/mappe/rete; Stripe i pagamenti e Google accesso/Analytics/Gmail. CLU non vende dati personali agli inserzionisti.']),
    S('7. Conservazione', ['Le sessioni scadono normalmente dopo 30 giorni. I normali dati diagnostici CLU sono destinati alla cancellazione dopo circa 30 giorni; informazioni di sicurezza possono restare fino a 90 giorni.', 'Quando una partita online viene chiusa, il suo stato di sessione attivo e gli snapshot tecnici vengono eliminati dall’infrastruttura della partita. Dopo la cancellazione dell’account, i mezzi di accesso vengono rimossi e l’account anonimizzato; pagamenti e prove legali possono restare per il periodo richiesto dagli obblighi applicabili.']),
    S('8. Diritti', [`Gli utenti possono esportare dati, chiedere rettifica, eliminare l’account ed esercitare i diritti di legge. Lo pseudonimo può cambiare ogni 15 giorni e il consenso Analytics può essere revocato da “Cookies”. Contatto: ${seller.email}.`]),
  ]),
  COOKIES: D('COOKIES', 'Politica cookie e archiviazione locale', legalSubtitle('it'), [
    S('1. Archiviazione necessaria', ['CLU usa archiviazione necessaria per preferenze, lingua, tutorial, privacy e salvataggi locali. IndexedDB viene usato tra l’altro per i salvataggi e localStorage per le preferenze. All’accesso viene usato un cookie di sessione necessario HttpOnly, Secure e SameSite=Lax, normalmente per 30 giorni.']),
    S('2. Google Analytics — opzionale', [`Google Analytics (${analyticsId}) viene caricato solo dopo il consenso alla misurazione del pubblico. Il rifiuto non blocca gioco o account.`]),
    S('3. Gestione della scelta', ['Rifiuto, personalizzazione e accettazione sono proposti allo stesso livello. La scelta viene memorizzata localmente e richiesta di nuovo dopo circa 183 giorni o con una nuova versione del consenso.']),
    S('4. Pubblicità', ['Google AdSense non è attivo al lancio. I segnali pubblicitari restano negati in questo livello finché non viene attivata una configurazione conforme.']),
    S('5. Eliminazione', ['I controlli del browser sui dati del sito possono eliminare preferenze, salvataggi locali e cookie di sessione.']),
  ]),
  CREDITS: D('CREDITS', 'Licenze e crediti', 'Principali licenze e attribuzioni usate da CLU', [
    S('OpenStreetMap & Protomaps', ['Le mappe reali si basano anche su dati OpenStreetMap sotto ODbL. Attribuzione: © OpenStreetMap contributors; le attribuzioni Protomaps/OSM applicabili devono restare visibili.']),
    S('MapLibre GL JS', ['CLU Métropole usa MapLibre GL JS sotto licenza BSD 3-Clause. Le note di copyright e licenza devono essere mantenute.']),
    S('PMTiles / Protomaps', ['PMTiles e relative implementazioni restano soggetti alle rispettive licenze e requisiti di attribuzione.']),
    S('BULB / origine del progetto pubblico CLU', ['Il progetto pubblico CLU deriva storicamente in parte da BULB; le parti riutilizzate conservano gli obblighi di licenza originari.']),
    S('Dipendenze, font, icone e audio', ['Ogni risorsa di terzi resta soggetta alla propria licenza; crediti e file di licenza richiesti devono essere mantenuti.']),
  ]),
}

const PT: Pack = {
  LEGAL: D('LEGAL', 'Aviso legal', legalSubtitle('pt'), [
    S('Editor e responsável pela publicação', [`${CLU_COMMERCIAL.productName} e o serviço CLU são editados por ${seller.sellerName}, sob o nome CLU, como pessoa singular.`, `Endereço de contacto: ${seller.address}. Email: ${seller.email}. Telefone: ${seller.phone}. Responsável pela publicação: ${seller.sellerName}.`, 'Esta versão não apresenta número de registo empresarial ou IVA porque nenhum foi comunicado ao CLU para publicação.']),
    S('Alojamento e infraestrutura', [`O site é publicado através de ${seller.hostName}. Endereço indicado para a entidade europeia do GitHub: ${seller.hostAddress}. Contacto: ${seller.hostContact}.`, `${seller.infrastructureName} fornece, nomeadamente, ${localizedInfrastructureDescription('pt')}.`]),
    S('Contacto', [`Questões sobre CLU, contas, pagamentos, privacidade ou direitos de dados podem ser enviadas para ${seller.email}.`]),
    S('Propriedade intelectual', ['Salvo indicação em contrário, código, textos, interface, identidade visual, sistemas de jogo, gráficos originais, música e conteúdos próprios do CLU estão protegidos. Elementos de terceiros permanecem sujeitos às respetivas licenças.']),
  ]),
  TERMS: D('TERMS', 'Termos de utilização', legalSubtitle('pt'), [
    S('1. Objeto e aceitação', ['Estes termos regulam CLU Métropole, contas CLU, funcionalidades online e serviços associados. Criar uma conta exige aceitar a versão em vigor.', 'As contas CLU destinam-se a pessoas com 18 anos ou mais.']),
    S('2. Conta CLU', ['A conta é identificada por um pseudónimo. Pode usar palavra-passe e, quando disponível, autenticação Google opcional. Credenciais e código de recuperação devem ser mantidos confidenciais.', 'É proibido vender, partilhar ou transferir uma conta CLU a terceiros.']),
    S('3. Pseudónimo', ['O pseudónimo pode ser visível para outros participantes online e pode ser alterado no máximo uma vez a cada 15 dias.', 'O CLU pode recusar ou alterar nomes abusivos, enganosos, ilícitos ou que imitem terceiros.']),
    S('4. Utilização aceitável e segurança', ['É proibido contornar controlos de acesso, perturbar o serviço, explorar falhas, automatizar pedidos abusivos, cometer fraude de pagamento ou aceder sem autorização a dados de terceiros.', 'O CLU pode limitar, suspender ou encerrar contas em caso de fraude, ataques, abuso ou tentativas de acesso não autorizado.']),
    S('5. Partidas, gravações e conteúdos', ['As gravações locais permanecem no dispositivo salvo exportação ou utilização online. Partidas online podem tratar pseudónimo, ID, permissões, ações, estado e snapshots técnicos.', 'O CLU não reivindica propriedade das criações originais dos jogadores e recebe apenas os direitos técnicos necessários para alojamento, sincronização, exportação e transmissão.']),
    S('6. Disponibilidade e eliminação', ['Manutenção, atualizações de segurança ou incidentes podem interromper temporariamente o serviço. Uma falha Premium importante pode justificar uma extensão.', 'Ao eliminar a conta, sessões e métodos de acesso são removidos; provas de pagamento ou legais necessárias podem ser conservadas de forma anonimizada. Premium termina e não é transferível.']),
    S('7. Direitos obrigatórios', [`Os direitos imperativos do consumidor mantêm-se. Questões ou reclamações: ${seller.email}.`]),
  ]),
  PREMIUM: D('PREMIUM', 'Condições CLU Premium', premiumSubtitle('pt'), [
    S('1. Oferta e preço', [`${premium.productName} custa ${LOCALIZED_LEGAL_META.pt.priceLabel} por um mês. É um pagamento único, sem renovação automática nem débito recorrente pelo CLU.`, 'Oferta de lançamento BETA: compras Premium confirmadas de 3 de outubro a 2 de novembro de 2026 inclusive recebem um mês Premium adicional sem custo, totalizando dois meses por 3,99 €.']),
    S('2. Ativação e duração', ['Premium é ativado após confirmação do pagamento pela Stripe. Se a conta não for Premium, o mês começa imediatamente.', 'Se Premium já estiver ativo, a duração concedida pela compra é adicionada à data de expiração existente. Durante a oferta de lançamento BETA são concedidos dois meses no total; fora da oferta, um mês. Ao expirar, a conta regressa automaticamente a Gratuita.']),
    S('3. Vantagens', ['Enquanto Premium estiver ativo, a conta pode:'], ['criar e alojar uma partida CLU online;', 'aceder ao CLU Desktop com ligação à Internet para verificar Premium;', 'apoiar o desenvolvimento e funcionamento do CLU.']),
    S('4. Pagamento', ['A Stripe processa os pagamentos. O CLU não armazena o número completo do cartão nem o código de segurança. O CLU conserva referências técnicas, montante, moeda, datas e período Premium concedido.']),
    S('5. Ativação imediata e retratação', ['Antes de ir para a Stripe, o utilizador solicita expressamente a ativação imediata após confirmação do pagamento.', `Os direitos legais imperativos mantêm-se. Pedidos de retratação ou reembolso podem ser enviados para ${seller.email}.`]),
    S('6. Reembolsos e incidentes', ['Pagamentos duplicados, Premium não ativado ou problemas técnicos comprovados podem ser reembolsados. Um reembolso total pode remover o período Premium correspondente. Uma falha grave do CLU pode gerar uma extensão.']),
    S('7. Conta e reclamações', [`Premium fica associado à conta compradora e, em princípio, não é transferível. Reclamações: ${seller.email}.`]),
  ]),
  PRIVACY: D('PRIVACY', 'Política de privacidade', legalSubtitle('pt'), [
    S('1. Responsável', [`O responsável é ${seller.sellerName}, CLU. Contacto: ${seller.email}. Endereço: ${seller.address}.`]),
    S('2. Dados da conta', ['O CLU pode tratar ID interno, pseudónimo e forma normalizada, datas da conta, estado Gratuito/Premium, expiração Premium e data da última alteração de pseudónimo.', 'Palavras-passe e códigos de recuperação são armazenados apenas como hashes criptográficos. Ao ligar Google, o CLU guarda apenas o identificador estável necessário à ligação e não procura guardar o email Google na base da conta.', 'As sessões contêm identificadores técnicos e datas de criação, expiração e última utilização.']),
    S('3. Pagamentos e provas jurídicas', ['A Stripe trata dados do cartão, nome e email na sua interface. O CLU não recebe o número completo do cartão nem o código de segurança.', 'O CLU guarda referências Stripe, montante, moeda, datas, eventuais dados de reembolso, períodos Premium e registos de aceitação de documentos jurídicos.']),
    S('4. Dados locais e partidas online', ['Definições, idioma, tutorial, escolha de privacidade e gravações locais podem ser armazenados em localStorage ou IndexedDB.', 'Partidas online podem tratar pseudónimo, ID, partidas criadas ou aderidas, permissões, ações, estado sincronizado e snapshots de recuperação. Durante uma sessão online ativa pode ser guardado temporariamente em sessionStorage um token de religação; é removido ao sair, fechar ou expirar a sessão. O CLU não reutiliza criações dos jogadores como banco comercial de conteúdos.']),
    S('5. Técnica, suporte e Analytics', [`Fornecedores técnicos podem tratar IP, informação do navegador, cabeçalhos de rede e logs de segurança. O suporte via ${seller.email} usa Google/Gmail. Google Analytics (${analyticsId}) só é carregado com consentimento. AdSense não está ativo no lançamento.`]),
    S('6. Finalidades e destinatários', ['Os dados servem para contas, autenticação, jogo, partidas online, Premium, pagamentos, suporte, prevenção de fraude e, com consentimento, medição de audiência.', 'GitHub aloja o site estático; Cloudflare fornece API/D1/R2/mapas/rede; Stripe pagamentos e Google login/Analytics/Gmail. O CLU não vende dados pessoais a anunciantes.']),
    S('7. Conservação', ['Sessões expiram normalmente após 30 dias. Dados comuns de diagnóstico do CLU destinam-se a ser eliminados após cerca de 30 dias; informação de segurança pode ser mantida até 90 dias.', 'Quando uma partida online é encerrada, o seu estado de sessão ativo e os snapshots técnicos são eliminados da infraestrutura da partida. Após eliminação da conta, meios de acesso são removidos e a conta anonimizada; pagamentos e provas jurídicas podem ser conservados pelo período exigido por obrigações aplicáveis.']),
    S('8. Direitos', [`Utilizadores podem exportar dados, pedir retificação, eliminar a conta e exercer direitos legais. O pseudónimo pode mudar a cada 15 dias e o consentimento Analytics pode ser retirado em “Cookies”. Contacto: ${seller.email}.`]),
  ]),
  COOKIES: D('COOKIES', 'Política de cookies e armazenamento local', legalSubtitle('pt'), [
    S('1. Armazenamento necessário', ['O CLU usa armazenamento necessário para preferências, idioma, tutorial, privacidade e gravações locais. IndexedDB é usado, entre outros, para gravações e localStorage para preferências. Ao iniciar sessão é usado um cookie necessário HttpOnly, Secure e SameSite=Lax, normalmente por 30 dias.']),
    S('2. Google Analytics — opcional', [`Google Analytics (${analyticsId}) só é carregado após consentimento para medição de audiência. Recusar não bloqueia jogo nem conta.`]),
    S('3. Gerir a escolha', ['Recusar, personalizar e aceitar são apresentados ao mesmo nível. A escolha é guardada localmente e pedida novamente após cerca de 183 dias ou nova versão do consentimento.']),
    S('4. Publicidade', ['Google AdSense não está ativo no lançamento. Os sinais publicitários permanecem recusados nesta camada até ser ativada uma configuração conforme.']),
    S('5. Eliminação', ['Os controlos do navegador para dados do site podem remover preferências, gravações locais e o cookie de sessão.']),
  ]),
  CREDITS: D('CREDITS', 'Licenças e créditos', 'Principais licenças e atribuições utilizadas pelo CLU', [
    S('OpenStreetMap & Protomaps', ['Mapas reais baseiam-se, entre outros, em dados OpenStreetMap sob ODbL. Atribuição: © OpenStreetMap contributors; atribuições Protomaps/OSM aplicáveis devem permanecer visíveis.']),
    S('MapLibre GL JS', ['CLU Métropole usa MapLibre GL JS sob licença BSD 3-Clause. Avisos de copyright e licença devem ser mantidos.']),
    S('PMTiles / Protomaps', ['PMTiles e implementações relacionadas continuam sujeitos às respetivas licenças e requisitos de atribuição.']),
    S('BULB / origem do projeto público CLU', ['O projeto público CLU deriva historicamente em parte do BULB; partes reutilizadas mantêm obrigações de licença originais.']),
    S('Dependências, fontes, ícones e áudio', ['Cada recurso de terceiros continua sujeito à sua própria licença; créditos e ficheiros de licença exigidos devem ser mantidos.']),
  ]),
}

const PL: Pack = {
  LEGAL: D('LEGAL', 'Informacje prawne', legalSubtitle('pl'), [
    S('Wydawca i osoba odpowiedzialna za publikację', [`${CLU_COMMERCIAL.productName} i usługa CLU są wydawane przez ${seller.sellerName} pod nazwą CLU jako osoba fizyczna.`, `Adres kontaktowy: ${seller.address}. E-mail: ${seller.email}. Telefon: ${seller.phone}. Odpowiedzialny za publikację: ${seller.sellerName}.`, 'W tej wersji nie podano numeru rejestracyjnego ani VAT, ponieważ CLU nie otrzymało takiego numeru do publikacji.']),
    S('Hosting i infrastruktura', [`Witryna jest publikowana przez ${seller.hostName}. Adres podany dla europejskiego podmiotu GitHub: ${seller.hostAddress}. Kontakt: ${seller.hostContact}.`, `${seller.infrastructureName} zapewnia m.in. ${localizedInfrastructureDescription('pl')}.`]),
    S('Kontakt', [`Pytania dotyczące CLU, kont, płatności, prywatności lub praw do danych można wysyłać na ${seller.email}.`]),
    S('Własność intelektualna', ['O ile nie wskazano inaczej, kod, teksty, interfejs, identyfikacja wizualna, systemy gry, oryginalna grafika, muzyka i własne treści CLU są chronione. Materiały stron trzecich pozostają objęte własnymi licencjami.']),
  ]),
  TERMS: D('TERMS', 'Warunki korzystania', legalSubtitle('pl'), [
    S('1. Zakres i akceptacja', ['Warunki dotyczą CLU Métropole, kont CLU, funkcji online i powiązanych usług. Utworzenie konta wymaga akceptacji aktualnej wersji.', 'Konta CLU są przeznaczone dla osób w wieku co najmniej 18 lat.']),
    S('2. Konto CLU', ['Konto jest identyfikowane pseudonimem. Można używać hasła i opcjonalnego logowania Google. Dane logowania i kod odzyskiwania muszą pozostać poufne.', 'Sprzedaż, udostępnianie lub przenoszenie konta CLU na inną osobę jest zabronione.']),
    S('3. Pseudonim', ['Pseudonim może być widoczny dla innych uczestników online i można go zmienić najwyżej raz na 15 dni.', 'CLU może odrzucić lub zmienić nazwę obraźliwą, wprowadzającą w błąd, bezprawną lub podszywającą się pod inną osobę.']),
    S('4. Dozwolone użycie i bezpieczeństwo', ['Zabronione jest omijanie kontroli dostępu, zakłócanie usługi, wykorzystywanie luk, automatyzowanie nadużyć, oszustwa płatnicze i nieuprawniony dostęp do cudzych danych.', 'CLU może ograniczyć, zawiesić lub zamknąć konto w razie oszustwa, ataków, nadużyć lub prób nieuprawnionego dostępu.']),
    S('5. Rozgrywki, zapisy i treści', ['Lokalne zapisy pozostają na urządzeniu, chyba że zostaną wyeksportowane lub użyte online. Rozgrywki online mogą przetwarzać pseudonim, ID, uprawnienia, działania, stan gry i techniczne snapshoty.', 'CLU nie rości sobie praw własności do oryginalnych dzieł graczy i otrzymuje tylko prawa techniczne potrzebne do hostingu, synchronizacji, eksportu i przesyłania.']),
    S('6. Dostępność i usunięcie', ['Konserwacja, aktualizacje bezpieczeństwa lub awarie mogą czasowo przerwać usługę. Poważna awaria Premium może skutkować wydłużeniem okresu.', 'Usunięcie konta kończy sesje i usuwa metody logowania; niezbędne dowody płatności lub prawne mogą być zachowane po anonimizacji. Premium wygasa i nie jest przenoszalne.']),
    S('7. Prawa bezwzględnie obowiązujące', [`Bezwzględnie obowiązujące prawa konsumenta pozostają w mocy. Pytania lub reklamacje: ${seller.email}.`]),
  ]),
  PREMIUM: D('PREMIUM', 'Warunki CLU Premium', premiumSubtitle('pl'), [
    S('1. Oferta i cena', [`${premium.productName} kosztuje ${LOCALIZED_LEGAL_META.pl.priceLabel} za jeden miesiąc. Jest to płatność jednorazowa bez automatycznego odnawiania i cyklicznych obciążeń CLU.`, 'Oferta startowa BETA: zakupy Premium potwierdzone od 3 października do 2 listopada 2026 r. włącznie otrzymują bez dopłaty dodatkowy miesiąc Premium, czyli łącznie dwa miesiące za 3,99 €.']),
    S('2. Aktywacja i czas', ['Premium jest aktywowany po potwierdzeniu płatności przez Stripe. Jeśli konto nie jest Premium, miesiąc zaczyna się od razu.', 'Jeśli Premium jest już aktywny, okres przyznany przez zakup jest dodawany do aktualnej daty wygaśnięcia. W czasie oferty startowej BETA są to łącznie dwa miesiące; poza ofertą jeden miesiąc. Po wygaśnięciu konto automatycznie wraca do Bezpłatnego.']),
    S('3. Korzyści', ['Podczas aktywnego Premium konto może:'], ['tworzyć i hostować rozgrywkę CLU online;', 'korzystać z CLU Desktop z połączeniem internetowym do weryfikacji Premium;', 'wspierać rozwój i działanie CLU.']),
    S('4. Płatność', ['Stripe obsługuje płatności. CLU nie przechowuje pełnego numeru karty ani kodu zabezpieczającego. CLU przechowuje techniczne identyfikatory płatności, kwotę, walutę, daty i przyznany okres Premium.']),
    S('5. Natychmiastowa aktywacja i odstąpienie', ['Przed przejściem do Stripe użytkownik wyraźnie żąda natychmiastowej aktywacji po potwierdzeniu płatności.', `Bezwzględnie obowiązujące prawa pozostają w mocy. Wnioski o odstąpienie lub zwrot: ${seller.email}.`]),
    S('6. Zwroty i awarie', ['Podwójna płatność, brak aktywacji Premium lub możliwy do potwierdzenia problem techniczny mogą skutkować zwrotem. Pełny zwrot może usunąć odpowiadający mu okres Premium. Poważna awaria CLU może skutkować przedłużeniem.']),
    S('7. Konto i reklamacje', [`Premium jest przypisany do konta kupującego i co do zasady nie jest przenoszalny. Reklamacje: ${seller.email}.`]),
  ]),
  PRIVACY: D('PRIVACY', 'Polityka prywatności', legalSubtitle('pl'), [
    S('1. Administrator', [`Administratorem jest ${seller.sellerName}, CLU. Kontakt: ${seller.email}. Adres: ${seller.address}.`]),
    S('2. Dane konta', ['CLU może przetwarzać wewnętrzny ID, pseudonim i wersję znormalizowaną, daty konta, status Bezpłatny/Premium, wygaśnięcie Premium i datę ostatniej zmiany pseudonimu.', 'Hasła i kody odzyskiwania są przechowywane wyłącznie jako kryptograficzne hashe. Po połączeniu Google CLU przechowuje tylko stabilny identyfikator potrzebny do połączenia i nie próbuje zapisywać adresu e-mail Google w bazie kont.', 'Sesje zawierają techniczne identyfikatory oraz daty utworzenia, wygaśnięcia i ostatniego użycia.']),
    S('3. Płatności i dowody prawne', ['Stripe przetwarza dane karty, imię/nazwę i e-mail w swoim interfejsie. CLU nie otrzymuje pełnego numeru karty ani kodu zabezpieczającego.', 'CLU przechowuje identyfikatory Stripe, kwotę, walutę, daty, ewentualne dane zwrotów, okresy Premium i rejestry akceptacji dokumentów prawnych.']),
    S('4. Dane lokalne i online', ['Ustawienia, język, samouczek, wybór prywatności i lokalne zapisy mogą być przechowywane w localStorage lub IndexedDB.', 'Rozgrywki online mogą przetwarzać pseudonim, ID, utworzone/dołączone gry, uprawnienia, działania, zsynchronizowany stan i snapshoty odzyskiwania. Podczas aktywnej sesji online tymczasowy token ponownego połączenia może być przechowywany w sessionStorage; jest usuwany po wyjściu, zamknięciu lub wygaśnięciu sesji. CLU nie wykorzystuje twórczości graczy jako komercyjnej bazy treści.']),
    S('5. Technika, wsparcie i Analytics', [`Dostawcy techniczni mogą przetwarzać IP, informacje o przeglądarce, nagłówki sieci i logi bezpieczeństwa. Wsparcie przez ${seller.email} używa Google/Gmail. Google Analytics (${analyticsId}) jest ładowany tylko po zgodzie. AdSense nie jest aktywny przy starcie.`]),
    S('6. Cele i odbiorcy', ['Dane służą do kont, uwierzytelniania, gry, rozgrywek online, Premium, płatności, wsparcia, zapobiegania oszustwom i – za zgodą – pomiaru odbiorców.', 'GitHub hostuje witrynę statyczną; Cloudflare zapewnia API/D1/R2/mapy/sieć; Stripe płatności, a Google logowanie/Analytics/Gmail. CLU nie sprzedaje danych osobowych reklamodawcom.']),
    S('7. Przechowywanie', ['Sesje zwykle wygasają po 30 dniach. Zwykłe dane diagnostyczne CLU mają być usuwane po około 30 dniach; informacje bezpieczeństwa mogą być przechowywane do 90 dni.', 'Po zamknięciu rozgrywki online jej aktywny stan sesji i snapshoty techniczne są usuwane z infrastruktury rozgrywki. Po usunięciu konta środki logowania są usuwane, a konto anonimizowane; płatności i dowody prawne mogą być przechowywane tak długo, jak wymagają tego obowiązujące obowiązki.']),
    S('8. Prawa', [`Użytkownicy mogą eksportować dane, żądać sprostowania, usunąć konto i wykonywać prawa ustawowe. Pseudonim można zmieniać co 15 dni, a zgodę Analytics cofnąć w „Cookies”. Kontakt: ${seller.email}.`]),
  ]),
  COOKIES: D('COOKIES', 'Polityka cookies i pamięci lokalnej', legalSubtitle('pl'), [
    S('1. Niezbędne przechowywanie', ['CLU używa niezbędnej pamięci dla preferencji, języka, samouczka, prywatności i lokalnych zapisów. IndexedDB służy m.in. zapisom, a localStorage preferencjom. Po zalogowaniu używany jest niezbędny cookie sesji HttpOnly, Secure i SameSite=Lax, zwykle przez 30 dni.']),
    S('2. Google Analytics — opcjonalny', [`Google Analytics (${analyticsId}) jest ładowany tylko po zgodzie na pomiar odbiorców. Odmowa nie blokuje gry ani konta.`]),
    S('3. Zarządzanie wyborem', ['Odrzucenie, dostosowanie i akceptacja są dostępne na równym poziomie. Wybór jest zapisywany lokalnie i ponownie wymagany po około 183 dniach lub przy nowej wersji zgody.']),
    S('4. Reklamy', ['Google AdSense nie jest aktywny w wersji startowej. Sygnały reklamowe pozostają odrzucone, dopóki nie zostanie włączona zgodna konfiguracja.']),
    S('5. Usuwanie', ['Narzędzia przeglądarki do usuwania danych witryny mogą usunąć preferencje, lokalne zapisy i cookie sesji.']),
  ]),
  CREDITS: D('CREDITS', 'Licencje i autorzy', 'Najważniejsze licencje i atrybucje używane przez CLU', [
    S('OpenStreetMap & Protomaps', ['Mapy rzeczywiste opierają się m.in. na danych OpenStreetMap na licencji ODbL. Atrybucja: © OpenStreetMap contributors; wymagane informacje Protomaps/OSM muszą pozostać widoczne.']),
    S('MapLibre GL JS', ['CLU Métropole używa MapLibre GL JS na licencji BSD 3-Clause. Informacje o prawach autorskich i licencji muszą zostać zachowane.']),
    S('PMTiles / Protomaps', ['PMTiles i powiązane implementacje pozostają objęte własnymi licencjami i wymogami atrybucji.']),
    S('BULB / pochodzenie publicznego projektu CLU', ['Publiczny projekt CLU historycznie częściowo wywodzi się z BULB; ponownie użyte elementy zachowują pierwotne obowiązki licencyjne.']),
    S('Zależności, fonty, ikony i audio', ['Każdy zasób strony trzeciej pozostaje objęty własną licencją; wymagane credits i pliki licencji muszą być zachowane.']),
  ]),
}


type LegalSupplement = Partial<Record<LegalDocumentId, ReturnType<typeof S>[]>>

const SUPPLEMENTS: Partial<Record<GameLocale, LegalSupplement>> = {
  en: {
    PREMIUM: [
      S('8. Withdrawal right for protected consumers', [
        'For consumers protected by French law or equivalent European Union rules, a distance service contract normally includes a 14-day withdrawal period from the date the contract is concluded.',
        'The user expressly asks CLU Premium to start before that period ends. If the purchased period has actually started and the consumer withdraws in time, a proportionate amount for the service already supplied may remain payable where the applicable law so provides.',
        'The user also acknowledges that once the service has been fully performed, the withdrawal right may end under the conditions laid down by law. This does not remove the legal conformity guarantee or other mandatory rights.',
        `A withdrawal can be sent by an unambiguous statement to ${seller.email} or ${seller.address}.`,
      ]),
      S('9. Legal conformity guarantee — digital service', [
        `The professional responsible for the guarantee is ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
        'CLU Premium is supplied continuously for the purchased period. The legal conformity guarantee applies throughout that period: one month outside the launch offer, or two months for a purchase covered by the BETA launch offer.',
        'CLU must provide the updates needed to maintain conformity during the applicable guarantee period. The consumer may request conformity without charge, unjustified delay or major inconvenience and may, in the cases provided by law, obtain a price reduction or terminate the contract.',
      ], undefined, true),
      S('10. Model withdrawal notice', [
        `Send only if you wish to withdraw: to ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
        'I notify you of my decision to withdraw from my CLU Premium purchase. Purchase date: [date]. Consumer name: [name]. Address: [address]. Date: [date]. Signature only for a paper notice.',
      ]),
    ],
    PRIVACY: [
      S('9. Legal bases, international transfers and additional rights', [
        'Account management, authentication, online functions and Premium activation rely on performance of the contract or requested pre-contractual steps. Legal records rely on a legal obligation where one applies. Security and fraud prevention may rely on CLU’s legitimate interests, subject to the required balancing test. Optional Google Analytics relies on consent.',
        'Providers may process data in several countries. Where a transfer outside the European Economic Area requires safeguards, it must rely on a recognised mechanism such as an adequacy decision, standard contractual clauses or another valid safeguard.',
        `Where applicable, users may request access, rectification, erasure, restriction, object to processing based on legitimate interests, exercise portability, withdraw consent and complain to the CNIL or another competent authority. Contact: ${seller.email}.`,
      ]),
    ],
  },
  de: {
    PREMIUM: [
      S('8. Widerrufsrecht für geschützte Verbraucher', [
        'Für Verbraucher, die dem französischen Recht oder einem gleichwertigen Schutz der Europäischen Union unterliegen, besteht bei einem Fernabsatzvertrag über Dienstleistungen grundsätzlich eine Widerrufsfrist von 14 Tagen ab Vertragsschluss.',
        'Der Nutzer verlangt ausdrücklich, dass CLU Premium vor Ablauf dieser Frist beginnt. Hat der gekaufte Zeitraum tatsächlich begonnen und wird rechtzeitig widerrufen, kann nach dem anwendbaren Recht ein anteiliger Betrag für die bereits erbrachte Leistung geschuldet bleiben.',
        'Der Nutzer bestätigt außerdem, dass das Widerrufsrecht nach vollständiger Erbringung der Leistung unter den gesetzlichen Voraussetzungen erlöschen kann. Gesetzliche Gewährleistungsrechte und sonstige zwingende Rechte bleiben unberührt.',
        `Der Widerruf kann durch eine eindeutige Erklärung an ${seller.email} oder ${seller.address} erfolgen.`,
      ]),
      S('9. Gesetzliche Konformitätsgarantie — digitaler Dienst', [
        `Für die Garantie verantwortlich: ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
        'CLU Premium wird während des gekauften Zeitraums fortlaufend bereitgestellt. Die gesetzliche Konformitätsgarantie gilt während dieses gesamten Zeitraums: einen Monat außerhalb des Startangebots oder zwei Monate bei einem Kauf im BETA-Startangebot.',
        'CLU muss während des Garantiezeitraums die zur Aufrechterhaltung der Konformität erforderlichen Aktualisierungen bereitstellen. Der Verbraucher kann eine kostenlose und unverzügliche Herstellung der Konformität und in den gesetzlich vorgesehenen Fällen eine Preisminderung oder Vertragsbeendigung verlangen.',
      ], undefined, true),
      S('10. Muster-Widerrufserklärung', [
        `Nur bei Widerruf senden: an ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
        'Hiermit teile ich meinen Widerruf des Kaufs von CLU Premium mit. Kaufdatum: [Datum]. Name: [Name]. Anschrift: [Anschrift]. Datum: [Datum]. Unterschrift nur bei Mitteilung auf Papier.',
      ]),
    ],
    PRIVACY: [
      S('9. Rechtsgrundlagen, internationale Übermittlungen und weitere Rechte', [
        'Kontoverwaltung, Authentifizierung, Online-Funktionen und Premium-Aktivierung beruhen auf Vertragserfüllung oder angeforderten vorvertraglichen Maßnahmen. Gesetzlich erforderliche Nachweise beruhen auf einer rechtlichen Verpflichtung. Sicherheit und Betrugsprävention können auf berechtigten Interessen von CLU beruhen, nach der erforderlichen Interessenabwägung. Optionales Google Analytics beruht auf Einwilligung.',
        'Anbieter können Daten in mehreren Ländern verarbeiten. Ist für eine Übermittlung außerhalb des Europäischen Wirtschaftsraums eine Garantie erforderlich, muss sie auf einem anerkannten Mechanismus wie Angemessenheitsbeschluss, Standardvertragsklauseln oder einer anderen gültigen Garantie beruhen.',
        `Soweit anwendbar bestehen Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch gegen Verarbeitung auf Grundlage berechtigter Interessen, Datenübertragbarkeit, Widerruf der Einwilligung und Beschwerde bei der zuständigen Datenschutzbehörde. Kontakt: ${seller.email}.`,
      ]),
    ],
  },
  nl: {
    PREMIUM: [
      S('8. Herroepingsrecht voor beschermde consumenten', [
        'Voor consumenten die onder Frans recht of een gelijkwaardige bescherming van de Europese Unie vallen, geldt bij een op afstand gesloten dienstencontract in beginsel een herroepingstermijn van 14 dagen vanaf het sluiten van de overeenkomst.',
        'De gebruiker vraagt uitdrukkelijk om CLU Premium vóór het einde van die termijn te laten starten. Als de gekochte periode daadwerkelijk is begonnen en tijdig wordt herroepen, kan volgens het toepasselijke recht een evenredig bedrag voor de reeds geleverde dienst verschuldigd blijven.',
        'De gebruiker erkent ook dat het herroepingsrecht na volledige uitvoering van de dienst onder de wettelijke voorwaarden kan eindigen. De wettelijke conformiteitsgarantie en andere dwingende rechten blijven bestaan.',
        `Herroeping kan via een ondubbelzinnige verklaring aan ${seller.email} of ${seller.address}.`,
      ]),
      S('9. Wettelijke conformiteitsgarantie — digitale dienst', [
        `Verantwoordelijke voor de garantie: ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
        'CLU Premium wordt doorlopend geleverd gedurende de gekochte periode. De wettelijke conformiteitsgarantie geldt gedurende die hele periode: één maand buiten de lanceringsaanbieding of twee maanden voor een aankoop onder de BETA-lanceringsaanbieding.',
        'CLU moet tijdens de toepasselijke garantieperiode de updates leveren die nodig zijn om de conformiteit te behouden. De consument kan kosteloos en zonder onredelijke vertraging herstel van conformiteit vragen en, in de wettelijk bepaalde gevallen, prijsvermindering of beëindiging van de overeenkomst.',
      ], undefined, true),
      S('10. Modelformulier voor herroeping', [
        `Alleen sturen als u wilt herroepen: aan ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
        'Ik deel mee dat ik mijn aankoop van CLU Premium herroep. Aankoopdatum: [datum]. Naam consument: [naam]. Adres: [adres]. Datum: [datum]. Handtekening alleen bij een papieren kennisgeving.',
      ]),
    ],
    PRIVACY: [
      S('9. Rechtsgronden, internationale doorgiften en aanvullende rechten', [
        'Accountbeheer, authenticatie, onlinefuncties en Premium-activering berusten op uitvoering van de overeenkomst of gevraagde precontractuele stappen. Wettelijk vereiste bewijsstukken berusten op een wettelijke verplichting. Beveiliging en fraudepreventie kunnen berusten op gerechtvaardigde belangen van CLU na de vereiste belangenafweging. Optionele Google Analytics berust op toestemming.',
        'Dienstverleners kunnen gegevens in meerdere landen verwerken. Als voor een doorgifte buiten de Europese Economische Ruimte waarborgen nodig zijn, moet die doorgifte steunen op een erkend mechanisme, zoals een adequaatheidsbesluit, standaardcontractbepalingen of een andere geldige waarborg.',
        `Waar van toepassing bestaan rechten op inzage, rectificatie, wissing, beperking, bezwaar tegen verwerking op basis van gerechtvaardigde belangen, overdraagbaarheid, intrekking van toestemming en een klacht bij de bevoegde toezichthouder. Contact: ${seller.email}.`,
      ]),
    ],
  },
  es: {
    PREMIUM: [
      S('8. Derecho de desistimiento para consumidores protegidos', [
        'Para consumidores protegidos por el Derecho francés o por una protección equivalente de la Unión Europea, un contrato de servicios a distancia dispone en principio de un plazo de desistimiento de 14 días desde su celebración.',
        'El usuario solicita expresamente que CLU Premium comience antes de que termine ese plazo. Si el periodo comprado ha comenzado realmente y el consumidor desiste dentro del plazo, puede quedar pendiente un importe proporcional al servicio ya prestado cuando la ley aplicable así lo prevea.',
        'El usuario reconoce asimismo que, una vez ejecutado completamente el servicio, el derecho de desistimiento puede extinguirse en las condiciones previstas por la ley. La garantía legal de conformidad y los demás derechos imperativos se mantienen.',
        `El desistimiento puede ejercerse mediante una declaración inequívoca enviada a ${seller.email} o ${seller.address}.`,
      ]),
      S('9. Garantía legal de conformidad — servicio digital', [
        `Profesional responsable de la garantía: ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
        'CLU Premium se presta de forma continua durante el periodo comprado. La garantía legal de conformidad se aplica durante todo ese periodo: un mes fuera de la oferta de lanzamiento o dos meses para una compra incluida en la oferta BETA de lanzamiento.',
        'CLU debe proporcionar durante el periodo de garantía las actualizaciones necesarias para mantener la conformidad. El consumidor puede exigir la puesta en conformidad sin coste ni demora injustificada y, en los casos previstos por la ley, una reducción del precio o la resolución del contrato.',
      ], undefined, true),
      S('10. Modelo de desistimiento', [
        `Enviar solo si desea desistir: a ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
        'Comunico mi decisión de desistir de mi compra de CLU Premium. Fecha de compra: [fecha]. Nombre: [nombre]. Dirección: [dirección]. Fecha: [fecha]. Firma solo en caso de envío en papel.',
      ]),
    ],
    PRIVACY: [
      S('9. Bases jurídicas, transferencias internacionales y derechos adicionales', [
        'La gestión de la cuenta, autenticación, funciones en línea y activación Premium se basan en la ejecución del contrato o en medidas precontractuales solicitadas. Los registros exigidos por ley se basan en una obligación legal. La seguridad y prevención del fraude pueden basarse en intereses legítimos de CLU, tras la ponderación exigida. Google Analytics opcional se basa en el consentimiento.',
        'Los proveedores pueden tratar datos en varios países. Cuando una transferencia fuera del Espacio Económico Europeo requiera garantías, debe apoyarse en un mecanismo reconocido como una decisión de adecuación, cláusulas contractuales tipo u otra garantía válida.',
        `Cuando proceda, existen derechos de acceso, rectificación, supresión, limitación, oposición a tratamientos basados en interés legítimo, portabilidad, retirada del consentimiento y reclamación ante la autoridad competente. Contacto: ${seller.email}.`,
      ]),
    ],
  },
  it: {
    PREMIUM: [
      S('8. Diritto di recesso per i consumatori tutelati', [
        'Per i consumatori protetti dal diritto francese o da una tutela equivalente dell’Unione europea, un contratto di servizi a distanza prevede in linea di principio un periodo di recesso di 14 giorni dalla conclusione del contratto.',
        'L’utente chiede espressamente che CLU Premium inizi prima della fine di tale periodo. Se il periodo acquistato è effettivamente iniziato e il consumatore recede nei termini, può restare dovuto un importo proporzionale al servizio già fornito quando la legge applicabile lo prevede.',
        'L’utente riconosce inoltre che, dopo la completa esecuzione del servizio, il diritto di recesso può cessare alle condizioni previste dalla legge. Restano impregiudicati la garanzia legale di conformità e gli altri diritti inderogabili.',
        `Il recesso può essere esercitato con una dichiarazione inequivoca inviata a ${seller.email} o ${seller.address}.`,
      ]),
      S('9. Garanzia legale di conformità — servizio digitale', [
        `Professionista responsabile della garanzia: ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
        'CLU Premium è fornito in modo continuativo durante il periodo acquistato. La garanzia legale di conformità si applica per tutto tale periodo: un mese fuori dall’offerta di lancio o due mesi per un acquisto coperto dall’offerta BETA di lancio.',
        'CLU deve fornire durante il periodo di garanzia gli aggiornamenti necessari a mantenere la conformità. Il consumatore può chiedere il ripristino della conformità senza costi né ritardi ingiustificati e, nei casi previsti dalla legge, una riduzione del prezzo o la risoluzione del contratto.',
      ], undefined, true),
      S('10. Modulo tipo di recesso', [
        `Inviare solo se si desidera recedere: a ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
        'Comunico la mia decisione di recedere dall’acquisto di CLU Premium. Data di acquisto: [data]. Nome: [nome]. Indirizzo: [indirizzo]. Data: [data]. Firma solo in caso di invio cartaceo.',
      ]),
    ],
    PRIVACY: [
      S('9. Basi giuridiche, trasferimenti internazionali e diritti aggiuntivi', [
        'Gestione dell’account, autenticazione, funzioni online e attivazione Premium si basano sull’esecuzione del contratto o su misure precontrattuali richieste. Le registrazioni imposte dalla legge si basano su un obbligo legale. Sicurezza e prevenzione delle frodi possono basarsi sul legittimo interesse di CLU, previa necessaria valutazione comparativa. Google Analytics facoltativo si basa sul consenso.',
        'I fornitori possono trattare dati in più Paesi. Quando un trasferimento fuori dallo Spazio economico europeo richiede garanzie, deve fondarsi su un meccanismo riconosciuto, come una decisione di adeguatezza, clausole contrattuali standard o altra garanzia valida.',
        `Ove applicabile, l’utente può esercitare accesso, rettifica, cancellazione, limitazione, opposizione ai trattamenti basati sul legittimo interesse, portabilità, revoca del consenso e reclamo all’autorità competente. Contatto: ${seller.email}.`,
      ]),
    ],
  },
  pt: {
    PREMIUM: [
      S('8. Direito de retratação para consumidores protegidos', [
        'Para consumidores protegidos pelo direito francês ou por proteção equivalente da União Europeia, um contrato de serviços celebrado à distância dispõe, em princípio, de um prazo de retratação de 14 dias a contar da celebração.',
        'O utilizador solicita expressamente que o CLU Premium comece antes do fim desse prazo. Se o período adquirido tiver efetivamente começado e o consumidor se retratar dentro do prazo, pode continuar devido um montante proporcional ao serviço já prestado quando a lei aplicável assim o preveja.',
        'O utilizador reconhece também que, após a execução completa do serviço, o direito de retratação pode cessar nas condições previstas na lei. A garantia legal de conformidade e os restantes direitos imperativos mantêm-se.',
        `A retratação pode ser exercida por declaração inequívoca enviada para ${seller.email} ou ${seller.address}.`,
      ]),
      S('9. Garantia legal de conformidade — serviço digital', [
        `Profissional responsável pela garantia: ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
        'O CLU Premium é fornecido continuamente durante o período adquirido. A garantia legal de conformidade aplica-se durante todo esse período: um mês fora da oferta de lançamento ou dois meses para uma compra abrangida pela oferta BETA de lançamento.',
        'O CLU deve fornecer, durante o período de garantia, as atualizações necessárias para manter a conformidade. O consumidor pode exigir a reposição da conformidade sem custos nem atrasos injustificados e, nos casos previstos na lei, uma redução do preço ou a resolução do contrato.',
      ], undefined, true),
      S('10. Modelo de retratação', [
        `Enviar apenas se pretender exercer a retratação: para ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
        'Comunico a minha decisão de me retratar da compra do CLU Premium. Data da compra: [data]. Nome: [nome]. Morada: [morada]. Data: [data]. Assinatura apenas em caso de envio em papel.',
      ]),
    ],
    PRIVACY: [
      S('9. Bases legais, transferências internacionais e direitos adicionais', [
        'Gestão da conta, autenticação, funções online e ativação Premium baseiam-se na execução do contrato ou em diligências pré-contratuais solicitadas. Registos exigidos por lei baseiam-se numa obrigação legal. Segurança e prevenção da fraude podem basear-se nos interesses legítimos do CLU, após a ponderação necessária. O Google Analytics opcional baseia-se no consentimento.',
        'Os prestadores podem tratar dados em vários países. Quando uma transferência para fora do Espaço Económico Europeu exija garantias, deve apoiar-se num mecanismo reconhecido, como uma decisão de adequação, cláusulas contratuais-tipo ou outra garantia válida.',
        `Quando aplicável, existem direitos de acesso, retificação, apagamento, limitação, oposição a tratamentos baseados em interesse legítimo, portabilidade, retirada do consentimento e reclamação junto da autoridade competente. Contacto: ${seller.email}.`,
      ]),
    ],
  },
  pl: {
    PREMIUM: [
      S('8. Prawo odstąpienia dla chronionych konsumentów', [
        'W przypadku konsumentów chronionych prawem francuskim lub równoważną ochroną Unii Europejskiej umowa o usługę zawarta na odległość co do zasady daje 14 dni na odstąpienie od dnia zawarcia umowy.',
        'Użytkownik wyraźnie żąda rozpoczęcia CLU Premium przed upływem tego terminu. Jeżeli zakupiony okres faktycznie się rozpoczął, a konsument odstąpi w terminie, zgodnie z właściwym prawem może pozostać do zapłaty proporcjonalna kwota za już świadczoną usługę.',
        'Użytkownik przyjmuje również do wiadomości, że po pełnym wykonaniu usługi prawo odstąpienia może wygasnąć na warunkach przewidzianych prawem. Gwarancja zgodności i inne bezwzględnie obowiązujące prawa pozostają w mocy.',
        `Odstąpienie można złożyć w jednoznacznym oświadczeniu wysłanym na ${seller.email} lub ${seller.address}.`,
      ]),
      S('9. Ustawowa gwarancja zgodności — usługa cyfrowa', [
        `Profesjonalistą odpowiedzialnym za gwarancję jest ${seller.sellerName} — CLU, ${seller.address}, ${seller.phone}, ${seller.email}.`,
        'CLU Premium jest świadczony w sposób ciągły przez zakupiony okres. Ustawowa gwarancja zgodności obowiązuje przez cały ten okres: jeden miesiąc poza ofertą startową lub dwa miesiące dla zakupu objętego ofertą startową BETA.',
        'CLU musi w okresie gwarancji zapewniać aktualizacje niezbędne do utrzymania zgodności. Konsument może żądać bezpłatnego i niezwłocznego przywrócenia zgodności, a w przypadkach przewidzianych prawem obniżenia ceny lub rozwiązania umowy.',
      ], undefined, true),
      S('10. Wzór oświadczenia o odstąpieniu', [
        `Wysłać tylko w przypadku odstąpienia: do ${seller.sellerName} — CLU, ${seller.address}, ${seller.email}.`,
        'Informuję o decyzji odstąpienia od zakupu CLU Premium. Data zakupu: [data]. Imię i nazwisko: [dane]. Adres: [adres]. Data: [data]. Podpis tylko przy wysyłce papierowej.',
      ]),
    ],
    PRIVACY: [
      S('9. Podstawy prawne, transfery międzynarodowe i dodatkowe prawa', [
        'Zarządzanie kontem, uwierzytelnianie, funkcje online i aktywacja Premium opierają się na wykonaniu umowy lub żądanych działaniach przedumownych. Ewidencja wymagana prawem opiera się na obowiązku prawnym. Bezpieczeństwo i zapobieganie oszustwom mogą opierać się na prawnie uzasadnionym interesie CLU po wymaganym teście równowagi. Opcjonalne Google Analytics opiera się na zgodzie.',
        'Dostawcy mogą przetwarzać dane w wielu krajach. Jeżeli transfer poza Europejski Obszar Gospodarczy wymaga zabezpieczeń, musi opierać się na uznanym mechanizmie, takim jak decyzja o adekwatności, standardowe klauzule umowne lub inna ważna gwarancja.',
        `W odpowiednich przypadkach użytkownik ma prawo dostępu, sprostowania, usunięcia, ograniczenia, sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie, przenoszenia danych, wycofania zgody i skargi do właściwego organu. Kontakt: ${seller.email}.`,
      ]),
    ],
  },
}

const PACKS: Partial<Record<GameLocale, Pack>> = {
  en: EN,
  de: DE,
  nl: NL,
  es: ES,
  it: IT,
  pt: PT,
  pl: PL,
}

export function localizedLegalDocument(id: LegalDocumentId, locale: GameLocale): LegalDocument {
  if (locale === 'fr') return LEGAL_DOCUMENTS[id]

  const base = PACKS[locale]?.[id] ?? EN[id]
  const supplements = SUPPLEMENTS[locale]?.[id] ?? []
  if (supplements.length === 0) return base

  return {
    ...base,
    sections: [...base.sections, ...supplements],
  }
}
