import { CLU_COMMERCIAL } from './commercial'
import { LEGAL_DOCUMENTS, type LegalDocument, type LegalDocumentId } from './legal'
import type { GameLocale } from '../types/i18n'

const seller = CLU_COMMERCIAL.legal
const analyticsId = CLU_COMMERCIAL.analytics.measurementId

const S = (title: string, paragraphs: string[] = [], bullets?: string[]) => ({ title, paragraphs, bullets })
const D = (
  id: LegalDocumentId,
  title: string,
  subtitle: string,
  sections: ReturnType<typeof S>[],
): LegalDocument => ({ id, title, subtitle, sections })

type Pack = Record<LegalDocumentId, LegalDocument>

const EN: Pack = {
  LEGAL: D('LEGAL', 'Legal notice', `Version ${seller.version} — ${seller.effectiveDate}`, [
    S('Hosting', [
      `The website is currently hosted via ${seller.hostName}. Known address of GitHub's European entity: ${seller.hostAddress}. Host contact: ${seller.hostContact}.`,
      'The hosting provider, domain or technical architecture may change. This notice should be updated if a change affects relevant legal information.',
    ]),
    S('How CLU Métropole works', [
      'CLU Métropole currently works without user accounts, CLU account sign-in, integrated payments or cloud save synchronisation.',
      'Game saves are stored locally in the user’s browser. Google Analytics may be loaded only after the user gives the corresponding consent.',
    ]),
    S('Intellectual property', [
      'Unless otherwise stated, CLU- and CLU Métropole-specific text, interface elements, visual identity, game systems, original graphics and proprietary code not covered by a third-party licence remain protected by applicable intellectual-property rules.',
      'CLU historically derives in part from BULB. Components, libraries, map data, fonts, icons and other third-party materials remain subject to their respective licences.',
      'Map data from sources such as OpenStreetMap/Protomaps and libraries such as MapLibre remain subject to their own licence and attribution requirements.',
    ]),
  ]),

  PRIVACY: D('PRIVACY', 'Privacy policy', `Version ${seller.version} — ${seller.effectiveDate}`, [
    S('1. General principle', [
      'CLU Métropole currently works without user accounts. The game does not ask for an email address, password, sign-in identifier, payment method or cloud save.',
      'Game data and preferences are mainly stored locally in the browser. Google Analytics is used only if the user accepts the “Audience measurement” category.',
    ]),
    S('2. Data stored locally', [
      'localStorage is used in particular for game settings, language, tutorial state and the Google Analytics consent choice.',
      'IndexedDB stores game saves and local technical backups. In the current version, these data remain on the device and are not sent to a CLU account API.',
      'Clearing website data in the browser may delete these settings and local saves.',
    ]),
    S('3. Google Analytics', [
      `Google Analytics is configured with measurement ID ${analyticsId}. CLU Métropole loads the Google Analytics script only after the user accepts audience measurement.`,
      'The current code requests IP anonymisation using anonymize_ip. Refusing Google Analytics does not prevent access to the game.',
      'Consent can be changed at any time through the “Cookies” button. When audience measurement is refused, this game layer does not intentionally load the Google Analytics script.',
    ]),
    S('4. Hosting and map resources', [
      'Loading the website and certain map resources requires network requests to the website host and to servers serving map files. As with any web request, those technical providers may receive information required to deliver the resource, including the IP address and browser information.',
      'CLU Métropole does not currently create a user account or user profile from those requests. Technical logs held by hosting providers are not defined by the CLU Métropole code and depend on those providers’ own practices.',
    ]),
    S('5. Purposes and legal basis', [
      'Necessary local storage is used to provide requested features such as preferences, tutorial progress, saves and remembering the privacy choice.',
      'Google Analytics is used only for audience measurement and general understanding of site usage. Where consent is required, this optional processing relies on consent.',
    ]),
    S('6. Retention', [
      'Saves, settings and local data remain in the browser until deleted by the game, the user or the browser.',
      'In the current code, the consent choice is stored locally for up to 183 days, after which a new choice may be requested.',
      'Google Analytics retention is determined by the Google Analytics property configuration and is not defined in this code repository. It must be checked in Google Analytics administration.',
    ]),
    S('7. Recipients and third parties', [
      'Google receives audience-measurement data only when Google Analytics is authorised.',
      'Hosting and technical-resource providers may receive the network data required to serve the website and requested files.',
      'CLU Métropole does not currently send game saves to an account service or cloud-sync service.',
    ]),
    S('8. Choices and rights', [
      'Google Analytics can be refused from the first consent banner and the choice can later be changed from “Cookies”. Refusal does not prevent use of the game.',
      'Users can also remove local CLU Métropole data using game functions or browser storage settings.',
      'Where applicable law grants rights concerning personal data, those rights apply to the processing actually carried out. Publisher contact details should be published with the legal notice where required.',
    ]),
  ]),

  COOKIES: D('COOKIES', 'Cookie and local storage policy', `Version ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Necessary storage', [
      'CLU Métropole uses local storage necessary for the features requested by the user, including settings, language, tutorial progress, saves and remembering the privacy choice.',
      'Game saves use IndexedDB. Preferences and the consent choice use localStorage in particular.',
      'These necessary storage mechanisms are not used to authenticate a user account: the current version of CLU Métropole has no account system.',
    ]),
    S('2. Google Analytics — optional', [
      'Google Analytics is optional audience measurement. Its script is loaded only if the user accepts the “Audience measurement” category.',
      'Refusal is offered at the same level as acceptance and does not block the game.',
    ]),
    S('3. Consent management', [
      'The banner allows the user to refuse, customise or accept audience measurement. The choice is stored locally so the user is not asked on every visit.',
      'In the current code, the choice expires after 183 days and can be changed at any time through the “Cookies” button.',
    ]),
    S('4. Advertising', [
      'CLU Métropole does not enable advertising trackers in the game. Google Consent Mode advertising signals remain denied by this layer.',
    ]),
    S('5. Removing local data', [
      'Users can clear website data from their browser. Doing so may also remove local game saves.',
      'Cookies or data already placed by a third party after consent may need to be removed through the browser or the relevant provider’s tools.',
    ]),
  ]),

  CREDITS: D('CREDITS', 'Licences and credits', 'Main licences and attributions used by CLU', [
    S('OpenStreetMap & Protomaps', [
      'Real map backgrounds used by CLU Métropole rely in particular on OpenStreetMap data. OpenStreetMap is an open database distributed under the Open Data Commons Open Database License (ODbL).',
      'Map attribution: © OpenStreetMap contributors. Where Protomaps backgrounds based on OpenStreetMap are used, the applicable Protomaps / OpenStreetMap attribution must remain visible.',
    ]),
    S('MapLibre GL JS', [
      'CLU Métropole uses MapLibre GL JS for map rendering. MapLibre GL JS is distributed under the BSD 3-Clause licence. Applicable copyright notices and licence terms must be retained.',
    ]),
    S('PMTiles / Protomaps', [
      'The PMTiles format and related implementations are used for maps. The licences and attribution requirements of the implementations used must be retained with distribution.',
    ]),
    S('BULB / origin of the public CLU project', [
      'The public CLU project historically derives from BULB. Reused portions remain subject to the licences and copyright notices of their respective sources.',
      'CLU Métropole-specific development never cancels licence obligations applying to reused third-party components.',
    ]),
    S('Dependencies, fonts, icons and audio', [
      'Each software dependency, font, icon, sound effect, audio track or other third-party resource remains subject to its own licence. Required credits and licence files must be retained.',
    ]),
  ]),
}

const DE: Pack = {
  LEGAL: D('LEGAL', 'Impressum', `Version ${seller.version} — ${seller.effectiveDate}`, [
    S('Hosting', [
      `Die Website wird derzeit über ${seller.hostName} gehostet. Bekannte Anschrift der europäischen GitHub-Gesellschaft: ${seller.hostAddress}. Kontakt des Hosters: ${seller.hostContact}.`,
      'Hosting, Domain oder technische Architektur können sich ändern. Diese Angaben sind zu aktualisieren, wenn sich dadurch rechtlich relevante Informationen ändern.',
    ]),
    S('Funktionsweise von CLU Métropole', [
      'CLU Métropole funktioniert derzeit ohne Benutzerkonto, ohne Anmeldung an einem CLU-Konto, ohne integrierte Zahlungen und ohne Cloud-Synchronisierung von Spielständen.',
      'Spielstände werden lokal im Browser gespeichert. Google Analytics kann nur nach entsprechender Einwilligung geladen werden.',
    ]),
    S('Geistiges Eigentum', [
      'Sofern nicht anders angegeben, bleiben CLU- und CLU-Métropole-spezifische Texte, Oberflächen, visuelle Identität, Spielsysteme, Originalgrafiken und eigener Code, der nicht unter einer Drittanbieter-Lizenz steht, nach den anwendbaren Regeln geschützt.',
      'CLU basiert historisch teilweise auf BULB. Komponenten, Bibliotheken, Kartendaten, Schriften, Symbole und andere Inhalte Dritter unterliegen weiterhin ihren jeweiligen Lizenzen.',
      'Kartendaten unter anderem aus OpenStreetMap/Protomaps sowie Bibliotheken wie MapLibre unterliegen ihren eigenen Lizenz- und Attributionsbedingungen.',
    ]),
  ]),
  PRIVACY: D('PRIVACY', 'Datenschutzerklärung', `Version ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Grundsatz', [
      'CLU Métropole funktioniert derzeit ohne Benutzerkonto. Das Spiel verlangt keine E-Mail-Adresse, kein Passwort, keine Anmeldekennung, kein Zahlungsmittel und keinen Cloud-Spielstand.',
      'Spieldaten und Einstellungen werden überwiegend lokal im Browser gespeichert. Google Analytics wird nur verwendet, wenn die Kategorie „Reichweitenmessung“ akzeptiert wurde.',
    ]),
    S('2. Lokal gespeicherte Daten', [
      'localStorage speichert insbesondere Spieleinstellungen, Sprache, Tutorial-Status und die Entscheidung zu Google Analytics.',
      'IndexedDB speichert Spielstände und lokale technische Sicherungen. In der aktuellen Version bleiben diese Daten auf dem Gerät und werden nicht an eine CLU-Konto-API gesendet.',
      'Das Löschen der Website-Daten im Browser kann diese Einstellungen und lokalen Spielstände entfernen.',
    ]),
    S('3. Google Analytics', [
      `Google Analytics ist mit der Mess-ID ${analyticsId} konfiguriert. CLU Métropole lädt das Google-Analytics-Skript nur nach Zustimmung zur Reichweitenmessung.`,
      'Der aktuelle Code fordert über anonymize_ip eine Anonymisierung der IP-Adresse an. Die Ablehnung von Google Analytics verhindert die Nutzung des Spiels nicht.',
      'Die Einwilligung kann jederzeit über „Cookies“ geändert werden. Bei Ablehnung lädt diese Spielebene das Google-Analytics-Skript nicht absichtlich.',
    ]),
    S('4. Hosting und Kartenressourcen', [
      'Das Laden der Website und bestimmter Kartenressourcen erfordert Netzwerkanfragen an den Website-Hoster und an Server, die Kartendateien bereitstellen. Wie bei jeder Webanfrage können diese technischen Anbieter die zur Übertragung nötigen Informationen erhalten, darunter IP-Adresse und Browserinformationen.',
      'CLU Métropole erstellt daraus derzeit kein Benutzerkonto oder Benutzerprofil. Technische Logs der Hosting-Anbieter werden nicht durch den CLU-Métropole-Code festgelegt.',
    ]),
    S('5. Zwecke und Rechtsgrundlage', [
      'Notwendige lokale Speicherungen dienen den angeforderten Funktionen wie Einstellungen, Tutorial, Spielständen und dem Merken der Datenschutzentscheidung.',
      'Google Analytics dient ausschließlich der Reichweitenmessung und dem allgemeinen Verständnis der Websitenutzung. Soweit eine Einwilligung erforderlich ist, beruht diese optionale Verarbeitung auf Einwilligung.',
    ]),
    S('6. Speicherdauer', [
      'Spielstände, Einstellungen und lokale Daten verbleiben im Browser, bis sie durch das Spiel, den Benutzer oder den Browser gelöscht werden.',
      'Die Einwilligungsentscheidung wird im aktuellen Code höchstens 183 Tage lokal gespeichert.',
      'Die Speicherdauer bei Google Analytics hängt von der Konfiguration der Google-Analytics-Property ab und ist nicht in diesem Code-Repository festgelegt.',
    ]),
    S('7. Empfänger und Dritte', [
      'Google erhält Daten zur Reichweitenmessung nur, wenn Google Analytics erlaubt wurde.',
      'Hosting- und Ressourcenanbieter können die Netzwerkdaten erhalten, die zur Bereitstellung der Website und angeforderten Dateien erforderlich sind.',
      'CLU Métropole sendet derzeit keine Spielstände an einen Konto- oder Cloud-Synchronisierungsdienst.',
    ]),
    S('8. Wahlmöglichkeiten und Rechte', [
      'Google Analytics kann im ersten Banner abgelehnt und später über „Cookies“ geändert werden. Die Ablehnung blockiert das Spiel nicht.',
      'Lokale CLU-Métropole-Daten können über Spielfunktionen oder Browser-Speichereinstellungen gelöscht werden.',
      'Soweit das anwendbare Recht Rechte in Bezug auf personenbezogene Daten gewährt, beziehen sie sich auf die tatsächlich erfolgenden Verarbeitungen. Erforderliche Kontaktdaten des Herausgebers sind mit dem Impressum zu veröffentlichen.',
    ]),
  ]),
  COOKIES: D('COOKIES', 'Cookie- und lokale Speicher-Richtlinie', `Version ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Notwendige Speicherungen', [
      'CLU Métropole verwendet lokale Speicherungen, die für die angeforderten Funktionen erforderlich sind, darunter Einstellungen, Sprache, Tutorial, Spielstände und die Datenschutzentscheidung.',
      'Spielstände verwenden IndexedDB. Einstellungen und die Einwilligungsentscheidung verwenden insbesondere localStorage.',
      'Diese Speicherungen dienen nicht der Anmeldung an einem Benutzerkonto: Die aktuelle Version von CLU Métropole besitzt kein Kontosystem.',
    ]),
    S('2. Google Analytics — optional', [
      'Google Analytics ist eine optionale Reichweitenmessung. Das Skript wird nur nach Zustimmung zur Kategorie „Reichweitenmessung“ geladen.',
      'Ablehnung und Zustimmung werden gleichwertig angeboten; eine Ablehnung blockiert das Spiel nicht.',
    ]),
    S('3. Einwilligung verwalten', [
      'Der Banner ermöglicht Ablehnen, Anpassen oder Akzeptieren der Reichweitenmessung. Die Entscheidung wird lokal gespeichert, damit nicht bei jedem Besuch erneut gefragt wird.',
      'Im aktuellen Code läuft diese Entscheidung nach 183 Tagen ab und kann jederzeit über „Cookies“ geändert werden.',
    ]),
    S('4. Werbung', ['CLU Métropole aktiviert keine Werbetracker im Spiel. Werbebezogene Signale des Google Consent Mode bleiben in dieser Ebene verweigert.']),
    S('5. Lokale Daten löschen', [
      'Website-Daten können im Browser gelöscht werden; dadurch können auch lokale Spielstände verloren gehen.',
      'Von Drittanbietern nach Einwilligung gesetzte Cookies oder Daten müssen gegebenenfalls über den Browser oder die Werkzeuge des jeweiligen Anbieters gelöscht werden.',
    ]),
  ]),
  CREDITS: D('CREDITS', 'Lizenzen und Credits', 'Wichtige von CLU verwendete Lizenzen und Attributionshinweise', [
    S('OpenStreetMap & Protomaps', ['Reale Kartenhintergründe von CLU Métropole basieren unter anderem auf OpenStreetMap-Daten. OpenStreetMap wird unter der Open Data Commons Open Database License (ODbL) bereitgestellt.', 'Kartenattribution: © OpenStreetMap contributors. Bei Protomaps-Hintergründen auf OpenStreetMap-Basis müssen die anwendbaren Protomaps-/OpenStreetMap-Hinweise sichtbar bleiben.']),
    S('MapLibre GL JS', ['CLU Métropole verwendet MapLibre GL JS zur Kartendarstellung. MapLibre GL JS steht unter der BSD-3-Clause-Lizenz. Anwendbare Copyright- und Lizenzhinweise sind beizubehalten.']),
    S('PMTiles / Protomaps', ['Das PMTiles-Format und zugehörige Implementierungen werden für Karten genutzt. Die Lizenzen und Attributionspflichten der eingesetzten Implementierungen sind beizubehalten.']),
    S('BULB / Ursprung des öffentlichen CLU-Projekts', ['Das öffentliche CLU-Projekt geht historisch auf BULB zurück. Wiederverwendete Teile bleiben den Lizenzen und Copyright-Hinweisen ihrer Quellen unterworfen.', 'Eigene Entwicklungen von CLU Métropole heben Lizenzpflichten für wiederverwendete Drittkomponenten nicht auf.']),
    S('Abhängigkeiten, Schriften, Symbole und Audio', ['Jede Softwareabhängigkeit, Schrift, jedes Symbol, jeder Soundeffekt, Audiotitel oder andere Drittinhalt unterliegt seiner eigenen Lizenz. Erforderliche Credits und Lizenzdateien sind beizubehalten.']),
  ]),
}

const NL: Pack = {
  LEGAL: D('LEGAL', 'Juridische informatie', `Versie ${seller.version} — ${seller.effectiveDate}`, [
    S('Hosting', [`De website wordt momenteel gehost via ${seller.hostName}. Bekend adres van de Europese GitHub-entiteit: ${seller.hostAddress}. Contact hoster: ${seller.hostContact}.`, 'Hosting, domein of technische architectuur kunnen wijzigen. Deze informatie moet worden bijgewerkt als een wijziging juridisch relevante gegevens beïnvloedt.']),
    S('Werking van CLU Métropole', ['CLU Métropole werkt momenteel zonder gebruikersaccount, zonder aanmelding bij een CLU-account, zonder geïntegreerde betalingen en zonder cloudsynchronisatie van opgeslagen spellen.', 'Spelopslagen worden lokaal in de browser bewaard. Google Analytics kan alleen worden geladen na de daarvoor bedoelde toestemming.']),
    S('Intellectuele eigendom', ['Tenzij anders vermeld, blijven teksten, interface-elementen, specifieke visuele identiteit, spelsystemen, originele grafische creaties en eigen code van CLU en CLU Métropole beschermd volgens de toepasselijke regels.', 'CLU is historisch gedeeltelijk gebaseerd op BULB. Componenten, bibliotheken, kaartgegevens, lettertypen, iconen en andere materialen van derden blijven onder hun eigen licenties vallen.', 'Kaartgegevens uit onder meer OpenStreetMap/Protomaps en bibliotheken zoals MapLibre blijven onder hun eigen licentie- en attributievoorwaarden vallen.']),
  ]),
  PRIVACY: D('PRIVACY', 'Privacybeleid', `Versie ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Algemeen principe', ['CLU Métropole werkt momenteel zonder gebruikersaccount. Het spel vraagt niet om een e-mailadres, wachtwoord, inlog-ID, betaalmiddel of cloudopslag.', 'Spelgegevens en voorkeuren worden voornamelijk lokaal in de browser opgeslagen. Google Analytics wordt alleen gebruikt als de gebruiker “Doelgroepmeting” accepteert.']),
    S('2. Lokaal opgeslagen gegevens', ['localStorage bewaart onder meer spelinstellingen, taal, tutorialstatus en de keuze rond Google Analytics.', 'IndexedDB bewaart spelopslagen en lokale technische back-ups. In de huidige versie blijven deze gegevens op het apparaat en worden ze niet naar een CLU-account-API verzonden.', 'Het wissen van websitegegevens in de browser kan deze instellingen en lokale spelopslagen verwijderen.']),
    S('3. Google Analytics', [`Google Analytics is ingesteld met meet-ID ${analyticsId}. CLU Métropole laadt het Google-Analytics-script alleen nadat de gebruiker doelgroepmeting accepteert.`, 'De huidige code vraagt IP-anonimisering via anonymize_ip. Google Analytics weigeren verhindert het spelen niet.', 'Toestemming kan op elk moment worden gewijzigd via “Cookies”. Bij weigering laadt deze spellaag het Google-Analytics-script niet bewust.']),
    S('4. Hosting en kaartbronnen', ['Het laden van de website en sommige kaartbestanden vereist netwerkverzoeken naar de websitehoster en servers die kaartbestanden leveren. Zoals bij elk webverzoek kunnen deze technische aanbieders de informatie ontvangen die nodig is voor levering, waaronder IP-adres en browserinformatie.', 'CLU Métropole maakt in de huidige versie geen gebruikersaccount of gebruikersprofiel op basis van deze verzoeken. Technische logs van hostingproviders worden niet door de CLU Métropole-code bepaald.']),
    S('5. Doeleinden en grondslag', ['Noodzakelijke lokale opslag dient voor gevraagde functies zoals voorkeuren, tutorial, spelopslagen en het onthouden van de privacykeuze.', 'Google Analytics wordt alleen gebruikt voor doelgroepmeting en algemeen inzicht in het gebruik van de site. Waar toestemming vereist is, berust deze optionele verwerking op toestemming.']),
    S('6. Bewaartermijnen', ['Spelopslagen, instellingen en lokale gegevens blijven in de browser totdat ze door het spel, de gebruiker of de browser worden verwijderd.', 'De toestemmingskeuze wordt in de huidige code maximaal 183 dagen lokaal opgeslagen.', 'De bewaartermijn van Google Analytics hangt af van de configuratie van de Google-Analytics-property en wordt niet in deze code vastgelegd.']),
    S('7. Ontvangers en derden', ['Google ontvangt doelgroepgegevens alleen wanneer Google Analytics is toegestaan.', 'Hosting- en technische aanbieders kunnen netwerkgegevens ontvangen die nodig zijn om de website en gevraagde bestanden te leveren.', 'CLU Métropole verzendt momenteel geen spelopslagen naar een account- of cloudsynchronisatiedienst.']),
    S('8. Keuzes en rechten', ['Google Analytics kan in de eerste banner worden geweigerd en later via “Cookies” worden gewijzigd. Weigering verhindert het spelen niet.', 'Lokale CLU Métropole-gegevens kunnen via het spel of de opslaginstellingen van de browser worden verwijderd.', 'Waar het toepasselijke recht rechten rond persoonsgegevens geeft, gelden die voor de daadwerkelijk uitgevoerde verwerkingen. Vereiste contactgegevens van de uitgever moeten bij de juridische informatie worden gepubliceerd.']),
  ]),
  COOKIES: D('COOKIES', 'Cookie- en lokaal-opslagbeleid', `Versie ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Noodzakelijke opslag', ['CLU Métropole gebruikt lokale opslag die nodig is voor gevraagde functies, waaronder instellingen, taal, tutorial, spelopslagen en de privacykeuze.', 'Spelopslagen gebruiken IndexedDB. Voorkeuren en toestemming gebruiken onder meer localStorage.', 'Deze opslag wordt niet gebruikt om een gebruikersaccount te authenticeren: de huidige versie van CLU Métropole heeft geen accountsysteem.']),
    S('2. Google Analytics — optioneel', ['Google Analytics is optionele doelgroepmeting. Het script wordt alleen geladen wanneer de gebruiker “Doelgroepmeting” accepteert.', 'Weigeren wordt even eenvoudig aangeboden als accepteren en blokkeert het spel niet.']),
    S('3. Toestemming beheren', ['De banner laat toe om doelgroepmeting te weigeren, aan te passen of te accepteren. De keuze wordt lokaal opgeslagen zodat niet bij elk bezoek opnieuw wordt gevraagd.', 'In de huidige code verloopt deze keuze na 183 dagen en kan ze altijd via “Cookies” worden gewijzigd.']),
    S('4. Reclame', ['CLU Métropole activeert geen advertentietrackers in het spel. Advertentiesignalen van Google Consent Mode blijven door deze laag geweigerd.']),
    S('5. Lokale gegevens verwijderen', ['Websitegegevens kunnen via de browser worden verwijderd; hierdoor kunnen ook lokale spelopslagen verdwijnen.', 'Cookies of gegevens die na toestemming door derden zijn geplaatst, moeten mogelijk via de browser of de hulpmiddelen van de betreffende aanbieder worden verwijderd.']),
  ]),
  CREDITS: D('CREDITS', 'Licenties en credits', 'Belangrijkste licenties en bronvermeldingen van CLU', [
    S('OpenStreetMap & Protomaps', ['Werkelijke kaartachtergronden van CLU Métropole zijn onder meer gebaseerd op OpenStreetMap-gegevens. OpenStreetMap is beschikbaar onder de Open Data Commons Open Database License (ODbL).', 'Kaartvermelding: © OpenStreetMap contributors. Bij Protomaps-kaarten op basis van OpenStreetMap moeten de toepasselijke Protomaps-/OpenStreetMap-vermeldingen zichtbaar blijven.']),
    S('MapLibre GL JS', ['CLU Métropole gebruikt MapLibre GL JS voor kaartweergave. MapLibre GL JS wordt verspreid onder de BSD 3-Clause-licentie. Relevante copyright- en licentievermeldingen moeten behouden blijven.']),
    S('PMTiles / Protomaps', ['Het PMTiles-formaat en bijbehorende implementaties worden gebruikt voor kaarten. Licenties en attributievoorwaarden van de gebruikte implementaties moeten behouden blijven.']),
    S('BULB / oorsprong van het publieke CLU-project', ['Het publieke CLU-project is historisch voortgekomen uit BULB. Hergebruikte delen blijven onder de licenties en copyrightvermeldingen van hun bronnen vallen.', 'Eigen ontwikkelingen van CLU Métropole heffen verplichtingen voor hergebruikte componenten van derden niet op.']),
    S('Afhankelijkheden, lettertypen, iconen en audio', ['Elke softwareafhankelijkheid, lettertype, icoon, geluidseffect, audiotrack of andere bron van derden blijft onder de eigen licentie vallen. Vereiste credits en licentiebestanden moeten behouden blijven.']),
  ]),
}

const ES: Pack = {
  LEGAL: D('LEGAL', 'Aviso legal', `Versión ${seller.version} — ${seller.effectiveDate}`, [
    S('Alojamiento', [`El sitio está alojado actualmente mediante ${seller.hostName}. Dirección conocida de la entidad europea de GitHub: ${seller.hostAddress}. Contacto del proveedor: ${seller.hostContact}.`, 'El alojamiento, el dominio o la arquitectura técnica pueden cambiar. Esta información debe actualizarse si un cambio afecta a los datos legales pertinentes.']),
    S('Funcionamiento de CLU Métropole', ['CLU Métropole funciona actualmente sin cuentas de usuario, sin inicio de sesión en una cuenta CLU, sin pagos integrados y sin sincronización en la nube de las partidas.', 'Las partidas se guardan localmente en el navegador. Google Analytics solo puede cargarse tras el consentimiento correspondiente.']),
    S('Propiedad intelectual', ['Salvo indicación contraria, los textos, interfaces, identidad visual específica, sistemas de juego, creaciones gráficas originales y código propio de CLU y CLU Métropole no cubierto por una licencia de terceros permanecen protegidos por la normativa aplicable.', 'CLU deriva históricamente en parte de BULB. Los componentes, bibliotecas, datos cartográficos, fuentes, iconos y demás elementos de terceros siguen sometidos a sus licencias respectivas.', 'Los datos cartográficos de fuentes como OpenStreetMap/Protomaps y bibliotecas como MapLibre siguen sometidos a sus propias condiciones de licencia y atribución.']),
  ]),
  PRIVACY: D('PRIVACY', 'Política de privacidad', `Versión ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Principio general', ['CLU Métropole funciona actualmente sin cuenta de usuario. El juego no solicita correo electrónico, contraseña, identificador de acceso, medio de pago ni guardado en la nube.', 'Los datos de juego y las preferencias se almacenan principalmente de forma local en el navegador. Google Analytics solo se utiliza si el usuario acepta “Medición de audiencia”.']),
    S('2. Datos almacenados localmente', ['localStorage guarda, entre otros elementos, ajustes del juego, idioma, estado del tutorial y la elección sobre Google Analytics.', 'IndexedDB almacena partidas y copias técnicas locales. En la versión actual, estos datos permanecen en el dispositivo y no se envían a una API de cuentas CLU.', 'Borrar los datos del sitio en el navegador puede eliminar estos ajustes y partidas locales.']),
    S('3. Google Analytics', [`Google Analytics está configurado con el identificador ${analyticsId}. CLU Métropole carga su script solo después de que el usuario acepte la medición de audiencia.`, 'El código actual solicita la anonimización de la IP mediante anonymize_ip. Rechazar Google Analytics no impide jugar.', 'El consentimiento puede modificarse en cualquier momento desde “Cookies”. Si se rechaza la medición, esta capa del juego no carga voluntariamente el script de Google Analytics.']),
    S('4. Alojamiento y recursos cartográficos', ['La carga del sitio y de ciertos recursos cartográficos requiere solicitudes de red al alojamiento del sitio y a servidores que distribuyen los archivos de mapas. Como en cualquier solicitud web, esos proveedores técnicos pueden recibir la información necesaria para servir el recurso, incluida la dirección IP y datos del navegador.', 'CLU Métropole no crea actualmente una cuenta o perfil de usuario a partir de esas solicitudes. Los registros técnicos de los proveedores no están definidos por el código de CLU Métropole.']),
    S('5. Finalidades y base', ['Los almacenamientos locales necesarios sirven para funciones solicitadas como preferencias, tutorial, partidas y memoria de la elección de privacidad.', 'Google Analytics se utiliza únicamente para medir audiencia y comprender de forma general el uso del sitio. Cuando se exige consentimiento, este tratamiento opcional se basa en él.']),
    S('6. Conservación', ['Las partidas, ajustes y datos locales permanecen en el navegador hasta que los eliminen el juego, el usuario o el navegador.', 'La elección de consentimiento se conserva localmente un máximo de 183 días en el código actual.', 'La conservación en Google Analytics depende de la configuración de la propiedad de Google Analytics y no se define en este repositorio.']),
    S('7. Destinatarios y terceros', ['Google recibe datos de medición únicamente cuando Google Analytics está autorizado.', 'Los proveedores de alojamiento y recursos técnicos pueden recibir los datos de red necesarios para servir el sitio y los archivos solicitados.', 'CLU Métropole no envía actualmente partidas a un servicio de cuentas o de sincronización en la nube.']),
    S('8. Elecciones y derechos', ['Google Analytics puede rechazarse desde el primer banner y la elección puede cambiarse después desde “Cookies”. El rechazo no impide jugar.', 'Los datos locales de CLU Métropole también pueden eliminarse desde el juego o los ajustes de almacenamiento del navegador.', 'Cuando la ley aplicable otorgue derechos relativos a datos personales, se aplican a los tratamientos realmente efectuados. Los datos de contacto del editor deben publicarse con el aviso legal cuando corresponda.']),
  ]),
  COOKIES: D('COOKIES', 'Política de cookies y almacenamiento local', `Versión ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Almacenamientos necesarios', ['CLU Métropole utiliza almacenamiento local necesario para las funciones solicitadas, como ajustes, idioma, tutorial, partidas y elección de privacidad.', 'Las partidas utilizan IndexedDB. Las preferencias y la elección de consentimiento utilizan, entre otros, localStorage.', 'Estos almacenamientos no sirven para autenticar una cuenta: la versión actual de CLU Métropole no tiene sistema de cuentas.']),
    S('2. Google Analytics — opcional', ['Google Analytics es una medición de audiencia opcional. Su script solo se carga cuando el usuario acepta “Medición de audiencia”.', 'Rechazar se ofrece con la misma facilidad que aceptar y no bloquea el juego.']),
    S('3. Gestión del consentimiento', ['El banner permite rechazar, personalizar o aceptar la medición. La elección se guarda localmente para no preguntar en cada visita.', 'En el código actual, la elección caduca después de 183 días y puede cambiarse en cualquier momento desde “Cookies”.']),
    S('4. Publicidad', ['CLU Métropole no activa rastreadores publicitarios en el juego. Las señales publicitarias de Google Consent Mode permanecen denegadas por esta capa.']),
    S('5. Eliminación de datos locales', ['El usuario puede borrar los datos del sitio desde el navegador, lo que también puede eliminar las partidas locales.', 'Los datos o cookies de terceros depositados tras el consentimiento pueden requerir su eliminación desde el navegador o las herramientas del proveedor correspondiente.']),
  ]),
  CREDITS: D('CREDITS', 'Licencias y créditos', 'Principales licencias y atribuciones utilizadas por CLU', [
    S('OpenStreetMap & Protomaps', ['Los fondos cartográficos reales de CLU Métropole se basan, entre otras fuentes, en datos de OpenStreetMap, distribuidos bajo Open Data Commons Open Database License (ODbL).', 'Atribución cartográfica: © OpenStreetMap contributors. Cuando se utilicen fondos Protomaps basados en OpenStreetMap, deben mantenerse visibles las atribuciones aplicables.']),
    S('MapLibre GL JS', ['CLU Métropole utiliza MapLibre GL JS para el renderizado cartográfico. MapLibre GL JS se distribuye bajo licencia BSD 3-Clause. Deben conservarse los avisos de copyright y licencia aplicables.']),
    S('PMTiles / Protomaps', ['El formato PMTiles y sus implementaciones se utilizan para los mapas. Deben conservarse las licencias y atribuciones de las implementaciones empleadas.']),
    S('BULB / origen del proyecto público CLU', ['El proyecto público CLU deriva históricamente de BULB. Las partes reutilizadas siguen sometidas a las licencias y avisos de copyright de sus fuentes.', 'Los desarrollos propios de CLU Métropole no eliminan las obligaciones de licencia aplicables a componentes de terceros reutilizados.']),
    S('Dependencias, fuentes, iconos y audio', ['Cada dependencia, fuente, icono, efecto de sonido, pista de audio u otro recurso de terceros permanece sujeto a su propia licencia. Deben conservarse los créditos y archivos de licencia exigidos.']),
  ]),
}

const IT: Pack = {
  LEGAL: D('LEGAL', 'Note legali', `Versione ${seller.version} — ${seller.effectiveDate}`, [
    S('Hosting', [`Il sito è attualmente ospitato tramite ${seller.hostName}. Indirizzo noto dell’entità europea di GitHub: ${seller.hostAddress}. Contatto host: ${seller.hostContact}.`, 'Hosting, dominio o architettura tecnica possono cambiare. Le presenti informazioni devono essere aggiornate se una modifica incide sui dati legali pertinenti.']),
    S('Funzionamento di CLU Métropole', ['CLU Métropole funziona attualmente senza account utente, senza accesso a un account CLU, senza pagamenti integrati e senza sincronizzazione cloud dei salvataggi.', 'I salvataggi restano nel browser. Google Analytics può essere caricato solo dopo il relativo consenso.']),
    S('Proprietà intellettuale', ['Salvo diversa indicazione, testi, interfacce, identità visiva specifica, sistemi di gioco, creazioni grafiche originali e codice proprietario di CLU e CLU Métropole non coperto da licenze di terzi restano protetti dalle norme applicabili.', 'CLU deriva storicamente in parte da BULB. Componenti, librerie, dati cartografici, font, icone e altri elementi di terzi restano soggetti alle rispettive licenze.', 'I dati cartografici provenienti tra l’altro da OpenStreetMap/Protomaps e librerie come MapLibre restano soggetti alle proprie condizioni di licenza e attribuzione.']),
  ]),
  PRIVACY: D('PRIVACY', 'Informativa sulla privacy', `Versione ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Principio generale', ['CLU Métropole funziona attualmente senza account utente. Il gioco non richiede email, password, identificatore di accesso, metodo di pagamento o salvataggio cloud.', 'Dati di gioco e preferenze vengono conservati principalmente nel browser. Google Analytics viene usato solo se l’utente accetta “Misurazione dell’audience”.']),
    S('2. Dati conservati localmente', ['localStorage conserva tra l’altro impostazioni, lingua, stato del tutorial e scelta relativa a Google Analytics.', 'IndexedDB conserva salvataggi e backup tecnici locali. Nella versione attuale questi dati restano sul dispositivo e non vengono inviati a un’API account CLU.', 'La cancellazione dei dati del sito dal browser può eliminare queste impostazioni e i salvataggi locali.']),
    S('3. Google Analytics', [`Google Analytics è configurato con l’ID ${analyticsId}. CLU Métropole carica lo script solo dopo il consenso alla misurazione dell’audience.`, 'Il codice attuale richiede l’anonimizzazione IP tramite anonymize_ip. Rifiutare Google Analytics non impedisce di giocare.', 'Il consenso può essere modificato in ogni momento da “Cookies”. In caso di rifiuto, questo livello del gioco non carica intenzionalmente lo script Google Analytics.']),
    S('4. Hosting e risorse cartografiche', ['Il caricamento del sito e di alcune risorse cartografiche richiede richieste di rete verso l’hosting e i server che distribuiscono i file cartografici. Come per ogni richiesta web, tali fornitori possono ricevere le informazioni tecniche necessarie, inclusi indirizzo IP e dati del browser.', 'CLU Métropole non crea attualmente un account o profilo utente a partire da tali richieste. I log tecnici dei fornitori non sono definiti dal codice di CLU Métropole.']),
    S('5. Finalità e base', ['Le memorie locali necessarie servono alle funzionalità richieste: preferenze, tutorial, salvataggi e memorizzazione della scelta privacy.', 'Google Analytics è usato solo per misurare l’audience e comprendere in generale l’uso del sito. Dove richiesto, il trattamento opzionale si basa sul consenso.']),
    S('6. Conservazione', ['Salvataggi, impostazioni e dati locali restano nel browser finché non vengono eliminati dal gioco, dall’utente o dal browser.', 'La scelta di consenso viene conservata localmente per un massimo di 183 giorni nel codice attuale.', 'La conservazione di Google Analytics dipende dalla configurazione della proprietà e non è definita in questo repository.']),
    S('7. Destinatari e terzi', ['Google riceve dati di misurazione solo quando Google Analytics è autorizzato.', 'I fornitori di hosting e risorse tecniche possono ricevere i dati di rete necessari a servire il sito e i file richiesti.', 'CLU Métropole non invia attualmente i salvataggi a servizi account o di sincronizzazione cloud.']),
    S('8. Scelte e diritti', ['Google Analytics può essere rifiutato dal primo banner e la scelta può essere modificata in seguito da “Cookies”. Il rifiuto non impedisce il gioco.', 'I dati locali di CLU Métropole possono essere rimossi dal gioco o dalle impostazioni di archiviazione del browser.', 'Quando la legge applicabile riconosce diritti sui dati personali, essi si applicano ai trattamenti effettivamente svolti. I contatti dell’editore devono essere pubblicati con le note legali quando richiesto.']),
  ]),
  COOKIES: D('COOKIES', 'Politica cookie e archiviazione locale', `Versione ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Archiviazioni necessarie', ['CLU Métropole usa archiviazioni locali necessarie alle funzioni richieste, tra cui impostazioni, lingua, tutorial, salvataggi e scelta privacy.', 'I salvataggi usano IndexedDB. Preferenze e consenso usano in particolare localStorage.', 'Queste archiviazioni non servono ad autenticare un account: la versione attuale di CLU Métropole non dispone di un sistema di account.']),
    S('2. Google Analytics — opzionale', ['Google Analytics è una misurazione dell’audience opzionale. Lo script viene caricato solo se l’utente accetta “Misurazione dell’audience”.', 'Rifiutare è semplice quanto accettare e non blocca il gioco.']),
    S('3. Gestione del consenso', ['Il banner consente di rifiutare, personalizzare o accettare la misurazione. La scelta è memorizzata localmente per non richiederla a ogni visita.', 'Nel codice attuale la scelta scade dopo 183 giorni e può essere modificata in ogni momento da “Cookies”.']),
    S('4. Pubblicità', ['CLU Métropole non attiva tracker pubblicitari nel gioco. I segnali pubblicitari di Google Consent Mode restano negati da questo livello.']),
    S('5. Eliminazione dei dati locali', ['I dati del sito possono essere cancellati dal browser; ciò può eliminare anche i salvataggi locali.', 'Cookie o dati già impostati da terzi dopo il consenso possono richiedere la cancellazione tramite browser o strumenti del relativo fornitore.']),
  ]),
  CREDITS: D('CREDITS', 'Licenze e crediti', 'Principali licenze e attribuzioni utilizzate da CLU', [
    S('OpenStreetMap & Protomaps', ['Le mappe reali di CLU Métropole si basano tra l’altro su dati OpenStreetMap, distribuiti con Open Data Commons Open Database License (ODbL).', 'Attribuzione cartografica: © OpenStreetMap contributors. Quando si usano fondi Protomaps basati su OpenStreetMap, le attribuzioni applicabili devono restare visibili.']),
    S('MapLibre GL JS', ['CLU Métropole usa MapLibre GL JS per il rendering cartografico. MapLibre GL JS è distribuito con licenza BSD 3-Clause. Gli avvisi di copyright e licenza applicabili devono essere mantenuti.']),
    S('PMTiles / Protomaps', ['Il formato PMTiles e le relative implementazioni sono usati per le mappe. Devono essere mantenute le licenze e attribuzioni delle implementazioni utilizzate.']),
    S('BULB / origine del progetto pubblico CLU', ['Il progetto pubblico CLU deriva storicamente da BULB. Le parti riutilizzate restano soggette alle licenze e agli avvisi di copyright delle rispettive fonti.', 'Gli sviluppi propri di CLU Métropole non eliminano gli obblighi di licenza dei componenti di terzi riutilizzati.']),
    S('Dipendenze, font, icone e audio', ['Ogni dipendenza, font, icona, effetto sonoro, traccia audio o altra risorsa di terzi resta soggetta alla propria licenza. I crediti e file di licenza richiesti devono essere conservati.']),
  ]),
}

const PT: Pack = {
  LEGAL: D('LEGAL', 'Aviso legal', `Versão ${seller.version} — ${seller.effectiveDate}`, [
    S('Alojamento', [`O site está atualmente alojado através de ${seller.hostName}. Endereço conhecido da entidade europeia da GitHub: ${seller.hostAddress}. Contacto do alojamento: ${seller.hostContact}.`, 'O alojamento, domínio ou arquitetura técnica podem mudar. Estas informações devem ser atualizadas se uma alteração afetar dados legais relevantes.']),
    S('Funcionamento do CLU Métropole', ['O CLU Métropole funciona atualmente sem conta de utilizador, sem início de sessão numa conta CLU, sem pagamentos integrados e sem sincronização cloud das gravações.', 'As gravações ficam localmente no navegador. O Google Analytics só pode ser carregado após o consentimento correspondente.']),
    S('Propriedade intelectual', ['Salvo indicação em contrário, textos, interfaces, identidade visual específica, sistemas de jogo, criações gráficas originais e código próprio do CLU e CLU Métropole não abrangido por licença de terceiros permanecem protegidos pelas regras aplicáveis.', 'O CLU deriva historicamente em parte do BULB. Componentes, bibliotecas, dados cartográficos, fontes, ícones e outros elementos de terceiros continuam sujeitos às respetivas licenças.', 'Dados cartográficos provenientes nomeadamente de OpenStreetMap/Protomaps e bibliotecas como MapLibre continuam sujeitos às respetivas condições de licença e atribuição.']),
  ]),
  PRIVACY: D('PRIVACY', 'Política de privacidade', `Versão ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Princípio geral', ['O CLU Métropole funciona atualmente sem conta de utilizador. O jogo não pede email, palavra-passe, identificador de acesso, meio de pagamento ou gravação cloud.', 'Dados de jogo e preferências são sobretudo guardados localmente no navegador. O Google Analytics é usado apenas se o utilizador aceitar “Medição de audiência”.']),
    S('2. Dados guardados localmente', ['localStorage guarda, entre outros, definições do jogo, idioma, estado do tutorial e escolha relativa ao Google Analytics.', 'IndexedDB guarda gravações e backups técnicos locais. Na versão atual, estes dados ficam no dispositivo e não são enviados para uma API de contas CLU.', 'Apagar os dados do site no navegador pode eliminar estas definições e gravações locais.']),
    S('3. Google Analytics', [`O Google Analytics está configurado com o ID ${analyticsId}. O CLU Métropole só carrega o script após aceitação da medição de audiência.`, 'O código atual pede anonimização de IP através de anonymize_ip. Recusar Google Analytics não impede jogar.', 'O consentimento pode ser alterado a qualquer momento em “Cookies”. Quando recusado, esta camada do jogo não carrega voluntariamente o script Google Analytics.']),
    S('4. Alojamento e recursos cartográficos', ['O carregamento do site e de certos recursos cartográficos exige pedidos de rede ao alojamento e aos servidores que distribuem os ficheiros. Como em qualquer pedido web, estes fornecedores podem receber informação técnica necessária, incluindo endereço IP e dados do navegador.', 'O CLU Métropole não cria atualmente conta ou perfil de utilizador a partir desses pedidos. Os logs técnicos dos fornecedores não são definidos pelo código do CLU Métropole.']),
    S('5. Finalidades e base', ['Os armazenamentos locais necessários servem as funcionalidades pedidas: preferências, tutorial, gravações e memorização da escolha de privacidade.', 'O Google Analytics serve apenas para medir audiência e compreender de forma geral a utilização do site. Quando exigido, este tratamento opcional baseia-se no consentimento.']),
    S('6. Conservação', ['Gravações, definições e dados locais permanecem no navegador até serem eliminados pelo jogo, utilizador ou navegador.', 'A escolha de consentimento é guardada localmente por no máximo 183 dias no código atual.', 'A conservação no Google Analytics depende da configuração da propriedade e não é definida neste repositório.']),
    S('7. Destinatários e terceiros', ['A Google recebe dados de medição apenas quando o Google Analytics é autorizado.', 'Fornecedores de alojamento e recursos técnicos podem receber dados de rede necessários para servir o site e os ficheiros pedidos.', 'O CLU Métropole não envia atualmente gravações para um serviço de contas ou sincronização cloud.']),
    S('8. Escolhas e direitos', ['O Google Analytics pode ser recusado no primeiro banner e a escolha pode ser alterada em “Cookies”. A recusa não impede jogar.', 'Os dados locais do CLU Métropole também podem ser eliminados através do jogo ou das definições de armazenamento do navegador.', 'Quando a lei aplicável atribui direitos sobre dados pessoais, estes aplicam-se aos tratamentos efetivamente realizados. Os contactos do editor devem ser publicados com o aviso legal quando exigido.']),
  ]),
  COOKIES: D('COOKIES', 'Política de cookies e armazenamento local', `Versão ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Armazenamentos necessários', ['O CLU Métropole utiliza armazenamento local necessário às funcionalidades pedidas, incluindo definições, idioma, tutorial, gravações e escolha de privacidade.', 'As gravações usam IndexedDB. Preferências e consentimento usam nomeadamente localStorage.', 'Estes armazenamentos não servem para autenticar uma conta: a versão atual do CLU Métropole não tem sistema de contas.']),
    S('2. Google Analytics — opcional', ['O Google Analytics é uma medição de audiência opcional. O script só é carregado quando o utilizador aceita “Medição de audiência”.', 'Recusar é tão simples como aceitar e não bloqueia o jogo.']),
    S('3. Gestão do consentimento', ['O banner permite recusar, personalizar ou aceitar a medição. A escolha é guardada localmente para não ser pedida em cada visita.', 'No código atual, a escolha expira após 183 dias e pode ser alterada em qualquer momento em “Cookies”.']),
    S('4. Publicidade', ['O CLU Métropole não ativa rastreadores publicitários no jogo. Os sinais publicitários do Google Consent Mode permanecem recusados nesta camada.']),
    S('5. Eliminação de dados locais', ['O utilizador pode apagar os dados do site no navegador; isso pode também eliminar gravações locais.', 'Cookies ou dados de terceiros colocados após consentimento podem exigir eliminação através do navegador ou das ferramentas do fornecedor.']),
  ]),
  CREDITS: D('CREDITS', 'Licenças e créditos', 'Principais licenças e atribuições utilizadas pelo CLU', [
    S('OpenStreetMap & Protomaps', ['Os fundos cartográficos reais do CLU Métropole baseiam-se nomeadamente em dados OpenStreetMap, distribuídos sob Open Data Commons Open Database License (ODbL).', 'Atribuição cartográfica: © OpenStreetMap contributors. Quando são usados fundos Protomaps baseados em OpenStreetMap, as atribuições aplicáveis devem permanecer visíveis.']),
    S('MapLibre GL JS', ['O CLU Métropole usa MapLibre GL JS para renderização cartográfica. O MapLibre GL JS é distribuído sob licença BSD 3-Clause. Devem ser mantidos os avisos de copyright e licença aplicáveis.']),
    S('PMTiles / Protomaps', ['O formato PMTiles e implementações relacionadas são usados para mapas. Devem ser mantidas as licenças e atribuições das implementações utilizadas.']),
    S('BULB / origem do projeto público CLU', ['O projeto público CLU deriva historicamente do BULB. Partes reutilizadas continuam sujeitas às licenças e avisos de copyright das respetivas fontes.', 'Desenvolvimentos próprios do CLU Métropole não eliminam obrigações de licença relativas a componentes de terceiros reutilizados.']),
    S('Dependências, fontes, ícones e áudio', ['Cada dependência, fonte, ícone, efeito sonoro, faixa de áudio ou outro recurso de terceiros continua sujeito à sua própria licença. Devem ser mantidos os créditos e ficheiros de licença exigidos.']),
  ]),
}

const PL: Pack = {
  LEGAL: D('LEGAL', 'Informacje prawne', `Wersja ${seller.version} — ${seller.effectiveDate}`, [
    S('Hosting', [`Serwis jest obecnie hostowany przez ${seller.hostName}. Znany adres europejskiego podmiotu GitHub: ${seller.hostAddress}. Kontakt z hostingiem: ${seller.hostContact}.`, 'Hosting, domena lub architektura techniczna mogą się zmienić. Informacje należy zaktualizować, jeśli zmiana wpływa na istotne dane prawne.']),
    S('Działanie CLU Métropole', ['CLU Métropole działa obecnie bez kont użytkowników, bez logowania do konta CLU, bez wbudowanych płatności i bez synchronizacji zapisów w chmurze.', 'Zapisy gry są przechowywane lokalnie w przeglądarce. Google Analytics może zostać załadowany dopiero po odpowiedniej zgodzie.']),
    S('Własność intelektualna', ['O ile nie wskazano inaczej, teksty, interfejsy, szczególna identyfikacja wizualna, systemy gry, oryginalne grafiki i własny kod CLU oraz CLU Métropole nieobjęty licencją strony trzeciej pozostają chronione na podstawie właściwych przepisów.', 'CLU historycznie częściowo wywodzi się z BULB. Komponenty, biblioteki, dane mapowe, fonty, ikony i inne elementy stron trzecich pozostają objęte własnymi licencjami.', 'Dane mapowe m.in. z OpenStreetMap/Protomaps oraz biblioteki takie jak MapLibre podlegają własnym warunkom licencji i atrybucji.']),
  ]),
  PRIVACY: D('PRIVACY', 'Polityka prywatności', `Wersja ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Zasada ogólna', ['CLU Métropole działa obecnie bez kont użytkowników. Gra nie wymaga adresu email, hasła, identyfikatora logowania, metody płatności ani zapisu w chmurze.', 'Dane gry i preferencje są przede wszystkim przechowywane lokalnie w przeglądarce. Google Analytics jest używany tylko po akceptacji „Pomiaru odbiorców”.']),
    S('2. Dane przechowywane lokalnie', ['localStorage przechowuje m.in. ustawienia gry, język, stan samouczka i wybór dotyczący Google Analytics.', 'IndexedDB przechowuje zapisy gry i lokalne kopie techniczne. W obecnej wersji dane te pozostają na urządzeniu i nie są wysyłane do API kont CLU.', 'Usunięcie danych witryny w przeglądarce może usunąć te ustawienia i lokalne zapisy.']),
    S('3. Google Analytics', [`Google Analytics jest skonfigurowany z identyfikatorem ${analyticsId}. CLU Métropole ładuje skrypt dopiero po zgodzie na pomiar odbiorców.`, 'Aktualny kod żąda anonimizacji IP przez anonymize_ip. Odmowa Google Analytics nie blokuje gry.', 'Zgodę można zmienić w dowolnym momencie przez „Cookies”. Po odmowie ta warstwa gry nie ładuje celowo skryptu Google Analytics.']),
    S('4. Hosting i zasoby mapowe', ['Ładowanie serwisu i części zasobów mapowych wymaga żądań sieciowych do hostingu i serwerów udostępniających pliki map. Jak w każdym żądaniu web, dostawcy techniczni mogą otrzymać informacje niezbędne do transmisji, w tym adres IP i dane przeglądarki.', 'CLU Métropole nie tworzy obecnie konta ani profilu użytkownika z tych żądań. Logi techniczne dostawców nie są definiowane przez kod CLU Métropole.']),
    S('5. Cele i podstawa', ['Niezbędne lokalne przechowywanie służy żądanym funkcjom: preferencjom, samouczkowi, zapisom i zapamiętaniu wyboru prywatności.', 'Google Analytics służy wyłącznie do pomiaru odbiorców i ogólnego zrozumienia korzystania z serwisu. Gdy wymagana jest zgoda, opcjonalne przetwarzanie opiera się na zgodzie.']),
    S('6. Okresy przechowywania', ['Zapisy, ustawienia i dane lokalne pozostają w przeglądarce do czasu usunięcia przez grę, użytkownika lub przeglądarkę.', 'W aktualnym kodzie wybór zgody jest przechowywany lokalnie maksymalnie przez 183 dni.', 'Okres przechowywania w Google Analytics zależy od konfiguracji usługi i nie jest określony w tym repozytorium.']),
    S('7. Odbiorcy i strony trzecie', ['Google otrzymuje dane pomiarowe tylko wtedy, gdy Google Analytics jest dozwolony.', 'Dostawcy hostingu i zasobów technicznych mogą otrzymywać dane sieciowe niezbędne do udostępnienia serwisu i żądanych plików.', 'CLU Métropole nie wysyła obecnie zapisów do usług kont lub synchronizacji chmurowej.']),
    S('8. Wybory i prawa', ['Google Analytics można odrzucić na pierwszym banerze i później zmienić wybór przez „Cookies”. Odmowa nie blokuje gry.', 'Lokalne dane CLU Métropole można również usunąć z poziomu gry lub ustawień pamięci przeglądarki.', 'Jeśli właściwe prawo przyznaje prawa dotyczące danych osobowych, odnoszą się one do faktycznie wykonywanych operacji. Wymagane dane kontaktowe wydawcy należy opublikować wraz z informacjami prawnymi.']),
  ]),
  COOKIES: D('COOKIES', 'Polityka cookies i pamięci lokalnej', `Wersja ${seller.version} — ${seller.effectiveDate}`, [
    S('1. Niezbędne przechowywanie', ['CLU Métropole używa lokalnego przechowywania niezbędnego do żądanych funkcji, w tym ustawień, języka, samouczka, zapisów i wyboru prywatności.', 'Zapisy gry używają IndexedDB. Preferencje i wybór zgody używają m.in. localStorage.', 'Te mechanizmy nie służą do uwierzytelniania konta: obecna wersja CLU Métropole nie ma systemu kont.']),
    S('2. Google Analytics — opcjonalny', ['Google Analytics jest opcjonalnym pomiarem odbiorców. Skrypt jest ładowany tylko po akceptacji „Pomiaru odbiorców”.', 'Odmowa jest równie łatwa jak akceptacja i nie blokuje gry.']),
    S('3. Zarządzanie zgodą', ['Baner pozwala odrzucić, dostosować lub zaakceptować pomiar. Wybór jest przechowywany lokalnie, aby nie pytać przy każdej wizycie.', 'W aktualnym kodzie wybór wygasa po 183 dniach i może być zmieniony w dowolnym momencie przez „Cookies”.']),
    S('4. Reklamy', ['CLU Métropole nie aktywuje trackerów reklamowych w grze. Sygnały reklamowe Google Consent Mode pozostają odrzucone przez tę warstwę.']),
    S('5. Usuwanie danych lokalnych', ['Użytkownik może usunąć dane witryny w przeglądarce; może to również usunąć lokalne zapisy gry.', 'Cookies lub dane umieszczone przez strony trzecie po zgodzie mogą wymagać usunięcia przez przeglądarkę lub narzędzia danego dostawcy.']),
  ]),
  CREDITS: D('CREDITS', 'Licencje i autorzy', 'Najważniejsze licencje i atrybucje używane przez CLU', [
    S('OpenStreetMap & Protomaps', ['Rzeczywiste podkłady mapowe CLU Métropole opierają się m.in. na danych OpenStreetMap, udostępnianych na licencji Open Data Commons Open Database License (ODbL).', 'Atrybucja map: © OpenStreetMap contributors. Przy użyciu podkładów Protomaps opartych na OpenStreetMap właściwe atrybucje muszą pozostać widoczne.']),
    S('MapLibre GL JS', ['CLU Métropole używa MapLibre GL JS do renderowania map. MapLibre GL JS jest dystrybuowany na licencji BSD 3-Clause. Właściwe informacje o prawach autorskich i warunki licencji muszą zostać zachowane.']),
    S('PMTiles / Protomaps', ['Format PMTiles i powiązane implementacje są używane do map. Licencje i wymagania atrybucji używanych implementacji muszą zostać zachowane.']),
    S('BULB / pochodzenie publicznego projektu CLU', ['Publiczny projekt CLU historycznie wywodzi się z BULB. Ponownie użyte fragmenty pozostają objęte licencjami i informacjami o prawach autorskich swoich źródeł.', 'Własne rozwiązania CLU Métropole nie znoszą obowiązków licencyjnych dotyczących wykorzystanych komponentów stron trzecich.']),
    S('Zależności, fonty, ikony i audio', ['Każda zależność programistyczna, font, ikona, efekt dźwiękowy, utwór audio lub inny zasób strony trzeciej pozostaje objęty własną licencją. Wymagane credits i pliki licencji muszą zostać zachowane.']),
  ]),
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

const CONTACT_COPY: Record<Exclude<GameLocale, 'fr'>, {
  title: string
  legal: string
  privacyTitle: string
  privacy: string[]
  noCheckbox: string
}> = {
  en: {
    title: 'Contact',
    legal: `For questions about CLU Métropole, privacy or personal-data requests: ${seller.email}.`,
    privacyTitle: 'Contact by email',
    privacy: [
      `If you contact CLU at ${seller.email}, your sender address, message content and any attachments are received in order to handle your request. These data do not come from gameplay and are not used to create a user account.`,
      'The contact mailbox is provided through Gmail. Message retention depends on how this mailbox is managed and on the provider settings.',
    ],
    noCheckbox: 'The first banner can record the choice through “Accept all” and “Reject all” buttons; no additional checkbox is required. The “Customize” panel provides a separate audience-measurement checkbox.',
  },
  de: {
    title: 'Kontakt',
    legal: `Für Fragen zu CLU Métropole, Datenschutz oder personenbezogenen Daten: ${seller.email}.`,
    privacyTitle: 'Kontakt per E-Mail',
    privacy: [
      `Wenn Sie CLU unter ${seller.email} kontaktieren, werden Ihre Absenderadresse, der Inhalt Ihrer Nachricht und etwaige Anhänge zur Bearbeitung Ihrer Anfrage empfangen. Diese Daten stammen nicht aus dem Spiel und werden nicht zur Erstellung eines Benutzerkontos verwendet.`,
      'Das Kontaktpostfach wird über Gmail bereitgestellt. Die Speicherdauer der Nachrichten hängt von der Verwaltung dieses Postfachs und den Einstellungen des Anbieters ab.',
    ],
    noCheckbox: 'Die Auswahl kann im ersten Banner über „Alle akzeptieren“ oder „Alle ablehnen“ erfolgen; ein zusätzliches Kontrollkästchen ist nicht erforderlich. Unter „Anpassen“ gibt es ein separates Kontrollkästchen für die Reichweitenmessung.',
  },
  nl: {
    title: 'Contact',
    legal: `Voor vragen over CLU Métropole, privacy of persoonsgegevens: ${seller.email}.`,
    privacyTitle: 'Contact per e-mail',
    privacy: [
      `Als u CLU via ${seller.email} contacteert, worden uw afzenderadres, de inhoud van uw bericht en eventuele bijlagen ontvangen om uw verzoek te behandelen. Deze gegevens komen niet uit de gameplay en worden niet gebruikt om een gebruikersaccount aan te maken.`,
      'De contactmailbox wordt via Gmail aangeboden. De bewaartermijn van berichten hangt af van het beheer van deze mailbox en de instellingen van de aanbieder.',
    ],
    noCheckbox: 'De eerste banner kan de keuze vastleggen via “Alles accepteren” en “Alles weigeren”; een extra selectievakje is niet nodig. Onder “Aanpassen” staat een apart selectievakje voor doelgroepmeting.',
  },
  es: {
    title: 'Contacto',
    legal: `Para cuestiones sobre CLU Métropole, privacidad o datos personales: ${seller.email}.`,
    privacyTitle: 'Contacto por email',
    privacy: [
      `Si contactas con CLU en ${seller.email}, se reciben tu dirección de remitente, el contenido del mensaje y los posibles archivos adjuntos para tramitar tu solicitud. Estos datos no proceden del juego y no se utilizan para crear una cuenta de usuario.`,
      'El buzón de contacto se presta mediante Gmail. La conservación de los mensajes depende de la gestión de ese buzón y de la configuración del proveedor.',
    ],
    noCheckbox: 'El primer banner puede registrar la elección mediante «Aceptar todo» y «Rechazar todo»; no hace falta una casilla adicional. «Personalizar» ofrece una casilla separada para la medición de audiencia.',
  },
  it: {
    title: 'Contatto',
    legal: `Per domande su CLU Métropole, privacy o dati personali: ${seller.email}.`,
    privacyTitle: 'Contatto via email',
    privacy: [
      `Se contatti CLU all’indirizzo ${seller.email}, vengono ricevuti l’indirizzo del mittente, il contenuto del messaggio e gli eventuali allegati per gestire la richiesta. Questi dati non provengono dal gameplay e non vengono utilizzati per creare un account utente.`,
      'La casella di contatto è fornita tramite Gmail. La conservazione dei messaggi dipende dalla gestione della casella e dalle impostazioni del fornitore.',
    ],
    noCheckbox: 'Il primo banner può registrare la scelta tramite «Accetta tutto» e «Rifiuta tutto»; non è necessaria una casella aggiuntiva. «Personalizza» offre una casella separata per la misurazione del pubblico.',
  },
  pt: {
    title: 'Contacto',
    legal: `Para questões sobre o CLU Métropole, privacidade ou dados pessoais: ${seller.email}.`,
    privacyTitle: 'Contacto por email',
    privacy: [
      `Se contactar o CLU através de ${seller.email}, o endereço do remetente, o conteúdo da mensagem e eventuais anexos são recebidos para tratar o pedido. Estes dados não provêm do jogo e não são usados para criar uma conta de utilizador.`,
      'A caixa de contacto é fornecida através do Gmail. A conservação das mensagens depende da gestão dessa caixa e das definições do fornecedor.',
    ],
    noCheckbox: 'O primeiro banner pode registar a escolha através de «Aceitar tudo» e «Recusar tudo»; não é necessária uma caixa adicional. «Personalizar» disponibiliza uma caixa separada para a medição de audiência.',
  },
  pl: {
    title: 'Kontakt',
    legal: `W sprawach dotyczących CLU Métropole, prywatności lub danych osobowych: ${seller.email}.`,
    privacyTitle: 'Kontakt e-mailowy',
    privacy: [
      `Jeśli skontaktujesz się z CLU pod adresem ${seller.email}, adres nadawcy, treść wiadomości i ewentualne załączniki są odbierane w celu obsługi zgłoszenia. Dane te nie pochodzą z rozgrywki i nie są używane do tworzenia konta użytkownika.`,
      'Skrzynka kontaktowa jest obsługiwana przez Gmail. Okres przechowywania wiadomości zależy od sposobu zarządzania skrzynką i ustawień dostawcy.',
    ],
    noCheckbox: 'Pierwszy baner może zapisać wybór za pomocą przycisków „Zaakceptuj wszystko” i „Odrzuć wszystko”; dodatkowe pole wyboru nie jest wymagane. W „Dostosuj” znajduje się osobne pole dla pomiaru odbiorców.',
  },
}

function decorateLocalizedDocument(
  document: LegalDocument,
  locale: Exclude<GameLocale, 'fr'>,
): LegalDocument {
  const copy = CONTACT_COPY[locale]
  const sections = document.sections.map(section => ({
    ...section,
    paragraphs: [...section.paragraphs],
    bullets: section.bullets ? [...section.bullets] : undefined,
  }))

  if (document.id === 'LEGAL' && seller.email) {
    sections.splice(1, 0, S(copy.title, [copy.legal]))
  }

  if (document.id === 'PRIVACY' && seller.email) {
    sections.splice(3, 0, S(copy.privacyTitle, copy.privacy))
    const rights = sections[sections.length - 1]
    rights?.paragraphs.push(copy.legal)
  }

  if (document.id === 'COOKIES') {
    const consent = sections[2]
    consent?.paragraphs.push(copy.noCheckbox)
  }

  return { ...document, sections }
}

export function localizedLegalDocument(
  id: LegalDocumentId,
  locale: GameLocale,
): LegalDocument {
  if (locale === 'fr') return LEGAL_DOCUMENTS[id]

  const translated = PACKS[locale]?.[id] ?? EN[id]
  return decorateLocalizedDocument(translated, locale)
}
