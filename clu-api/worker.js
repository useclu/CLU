import {
  CLU_ONLINE_ALPHABET_CODE,
  CLU_ONLINE_GRACE_MS,
  CLU_ONLINE_MAX_ATTENTE,
  CLU_ONLINE_MAX_JOUEURS,
  CLU_ONLINE_MAX_SNAPSHOT_MESSAGE,
  CLU_ONLINE_MAX_WS_MESSAGE,
  CLU_ONLINE_MAX_MUTATION_MESSAGE,
  CLU_ONLINE_MAX_PATCHES,
  CLU_ONLINE_MUTATION_PREFIX,
  CLU_ONLINE_MUTATION_RATE_MAX,
  CLU_ONLINE_MUTATION_RATE_WINDOW_MS,
  CLU_ONLINE_PENDING_RECONNECT_MS,
  CLU_ONLINE_PENDING_REQUEST_MS,
  CLU_ONLINE_PERMISSIONS,
  CLU_ONLINE_PROTOCOL_VERSION,
  CLU_ONLINE_RESERVATION_MS,
  CLU_ONLINE_SNAPSHOT_CHUNK_PREFIX,
  CLU_ONLINE_SNAPSHOT_CHUNK_SIZE,
  CLU_ONLINE_SNAPSHOT_INTERVAL,
  CLU_ONLINE_SNAPSHOT_META_KEY,
  CLU_ONLINE_WS_TICKET_TTL_MS,
  nettoyerPermissionsOnline,
  permissionsOnlineEdition,
  permissionsOnlineLectureSeule,
  permissionsOnlineToutes,
  permissionsPourProfilOnline,
} from './online-config.js';

const ORIGINES_AUTORISEES = new Set([

  "https://useclu.pro",

  "https://www.useclu.pro",

]);


/**
 * Google Identity Services.
 *
 * Le Client ID n'est pas un secret : il est aussi utilisé côté navigateur.
 * GOOGLE_CLIENT_ID peut être défini dans les variables du Worker pour éviter
 * de dépendre de la valeur de secours ci-dessous.
 */

const GOOGLE_CLIENT_ID_PAR_DEFAUT =
  "451693879310-tq2mti1fbrpqnaut77mu4u83pkb2pdmu.apps.googleusercontent.com";

const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/oauth2/v3/certs";

let cacheGoogleJwks = {
  expiration: 0,
  cles: [],
};


/**
 * Stripe Checkout — CLU Premium.
 *
 * STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET doivent être stockés dans
 * les variables/secrets du Worker. Le tarif est fourni par
 * STRIPE_PRICE_PREMIUM. Aucune clé secrète Stripe n'est écrite ici.
 */

const STRIPE_API_BASE_URL =
  "https://api.stripe.com/v1";

const STRIPE_OFFRE_PREMIUM =
  "clu_premium_1_mois";

const STRIPE_MONTANT_PREMIUM_CENTIMES =
  399;

const STRIPE_DEVISE_PREMIUM =
  "eur";

// Offre de lancement BÊTA : tout achat Premium confirmé du 3 octobre 2026
// au 2 novembre 2026 inclus accorde un second mois sans renouvellement.
// Bornes correspondant aux dates calendaires annoncées en France métropolitaine :
// 03/10/2026 00:00 Europe/Paris (UTC+2) -> 02/10/2026 22:00 UTC
// 03/11/2026 00:00 Europe/Paris (UTC+1) -> 02/11/2026 23:00 UTC
const PREMIUM_LAUNCH_OFFER_START = Date.UTC(2026, 9, 2, 22, 0, 0, 0);
const PREMIUM_LAUNCH_OFFER_END_EXCLUSIVE = Date.UTC(2026, 10, 2, 23, 0, 0, 0);

function moisPremiumPourDate(timestamp) {
  const date = Number(timestamp);
  return Number.isFinite(date) && date >= PREMIUM_LAUNCH_OFFER_START && date < PREMIUM_LAUNCH_OFFER_END_EXCLUSIVE ? 2 : 1;
}

const STRIPE_TOLERANCE_SIGNATURE_SECONDES =
  300;

const VERSION_JURIDIQUE_COMPTE = "1.1";
const VERSION_JURIDIQUE_PREMIUM = "1.1";
const DELAI_CHANGEMENT_PSEUDO_MS = 15 * 24 * 60 * 60 * 1000;

// Les nouveaux mots de passe utilisent le coût PBKDF2 courant. Les anciens
// hashes à 100 000 itérations restent compatibles et sont renforcés lors de
// la prochaine connexion réussie, sans migration D1 ni reset imposé.
const PBKDF2_ITERATIONS_COURANTES = 600000;
const PBKDF2_ITERATIONS_LEGACY_MIN = 100000;
const PBKDF2_ITERATIONS_MAX_ACCEPTEES = 1000000;



function reponseJson(donnees, statut = 200, entetes = {}) {

  return new Response(JSON.stringify(donnees), {

    status: statut,

    headers: {

      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",

      ...entetes,

    },

  });

}



function origineAutorisee(request) {

  const origine = request.headers.get("Origin");



  // PowerShell, curl, applications natives, etc.

  if (!origine) {

    return true;

  }



  return ORIGINES_AUTORISEES.has(origine);

}


function origineWebSocketDeveloppementAutorisee(request) {
  const origine = request.headers.get("Origin");
  if (!origine) return false;
  try {
    const url = new URL(origine);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}



function estRequeteNavigateurCrossSite(request) {

  return (

    request.headers.get("Sec-Fetch-Site") ===

    "cross-site"

  );

}



function ajouterCors(request, response) {

  // Une réponse WebSocket 101 contient l'upgrade lui-même. La reconstruire
  // ferait perdre le WebSocket associé et casserait la connexion temps réel.
  if (response?.status === 101) {
    return response;
  }

  const origine =

    request.headers.get("Origin");



  if (

    !origine ||

    !ORIGINES_AUTORISEES.has(origine)

  ) {

    return response;

  }



  const headers =

    new Headers(response.headers);



  headers.set(

    "Access-Control-Allow-Origin",

    origine

  );



  headers.set(

    "Access-Control-Allow-Credentials",

    "true"

  );



  headers.set(

    "Access-Control-Expose-Headers",

    "Retry-After"

  );



  const vary = headers.get("Vary");



  if (!vary) {

    headers.set("Vary", "Origin");

  } else if (

    !vary

      .toLowerCase()

      .split(",")

      .map((valeur) => valeur.trim())

      .includes("origin")

  ) {

    headers.set(

      "Vary",

      `${vary}, Origin`

    );

  }



  return new Response(

    response.body,

    {

      status: response.status,

      statusText:

        response.statusText,

      headers,

    }

  );

}



function reponsePreflight(request) {

  const origine =

    request.headers.get("Origin");



  if (

    !origine ||

    !ORIGINES_AUTORISEES.has(origine)

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Origine non autorisée.",

      },

      403

    );

  }



  return new Response(null, {

    status: 204,

    headers: {

      "Access-Control-Allow-Origin":

        origine,



      "Access-Control-Allow-Credentials":

        "true",



      "Access-Control-Allow-Methods":

        "GET, POST, OPTIONS",



      "Access-Control-Allow-Headers":

        "Content-Type, Cache-Control",



      "Access-Control-Max-Age":

        "86400",



      "Vary":

        "Origin",

    },

  });

}



function reponseTropDeTentatives() {

  return reponseJson(

    {

      ok: false,

      erreur:

        "Trop de tentatives. Réessayez dans une minute.",

    },

    429,

    {

      "Retry-After": "60",

    }

  );

}



function cookieSession(jeton, dureeSecondes) {

  return [

    `clu_session=${jeton}`,

    "HttpOnly",

    "Secure",

    "SameSite=Lax",

    "Path=/",

    `Max-Age=${dureeSecondes}`,

  ].join("; ");

}



function cookieSessionExpire() {

  return [

    "clu_session=",

    "HttpOnly",

    "Secure",

    "SameSite=Lax",

    "Path=/",

    "Max-Age=0",

  ].join("; ");

}



function normaliserPseudo(pseudo) {

  return pseudo

    .trim()

    .normalize("NFKC")

    .toLowerCase();

}



function normaliserChemin(chemin) {

  if (

    chemin.length > 1 &&

    chemin.endsWith("/")

  ) {

    return chemin.slice(0, -1);

  }



  return chemin;

}



function normaliserCodeRecuperation(code) {

  const brut = String(code || "")

    .trim()

    .toUpperCase()

    .replace(/[\s-]+/g, "");



  if (!/^[0-9A-Z]+$/.test(brut)) {

    return "";

  }



  const groupes =

    brut.match(/.{1,4}/g);



  return groupes

    ? groupes.join("-")

    : "";

}



function estPremiumActif(premiumJusquA) {

  const expiration =
    Number(premiumJusquA);

  return (
    Number.isFinite(expiration) &&
    expiration > Date.now()
  );

}



function ajouterUnMoisUTC(timestamp) {

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(date.getTime())
  ) {

    throw new Error(
      "Date Premium invalide."
    );

  }

  const jourInitial =
    date.getUTCDate();

  date.setUTCDate(1);
  date.setUTCMonth(
    date.getUTCMonth() + 1
  );

  const dernierJourDuMois =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

  date.setUTCDate(
    Math.min(
      jourInitial,
      dernierJourDuMois
    )
  );

  return date.getTime();

}

function ajouterMoisPremiumUTC(timestamp, nombreMois = 1) {
  let resultat = timestamp;
  const total = Math.max(1, Math.min(24, Math.trunc(Number(nombreMois) || 1)));
  for (let index = 0; index < total; index++) resultat = ajouterUnMoisUTC(resultat);
  return resultat;
}


function prochainChangementPseudo(dateChangementPseudo) {
  const dernier = Number(dateChangementPseudo);
  if (!Number.isFinite(dernier) || dernier <= 0) return null;
  return dernier + DELAI_CHANGEMENT_PSEUDO_MS;
}

async function enregistrerAcceptationsLegales(env, utilisateurId, acceptations) {
  if (!Array.isArray(acceptations) || !acceptations.length) return;
  const maintenant = Date.now();
  const statements = acceptations.map(({ type, version }) =>
    env.db.prepare(`
      INSERT INTO acceptations_legales (
        id, utilisateur_id, type_document, version_document, date_acceptation
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      utilisateurId,
      String(type),
      String(version),
      maintenant
    )
  );
  await env.db.batch(statements);
}

function octetsVersBase64Url(octets) {

  let texte = "";



  for (const octet of octets) {

    texte +=

      String.fromCharCode(octet);

  }



  return btoa(texte)

    .replace(/\+/g, "-")

    .replace(/\//g, "_")

    .replace(/=+$/g, "");

}



function base64UrlVersOctets(texte) {

  const base64 = texte

    .replace(/-/g, "+")

    .replace(/_/g, "/")

    .padEnd(

      Math.ceil(

        texte.length / 4

      ) * 4,

      "="

    );



  const binaire =

    atob(base64);



  const octets =

    new Uint8Array(

      binaire.length

    );



  for (

    let i = 0;

    i < binaire.length;

    i++

  ) {

    octets[i] =

      binaire.charCodeAt(i);

  }



  return octets;

}



function base64UrlVersTexte(texte) {

  return new TextDecoder().decode(

    base64UrlVersOctets(texte)

  );

}



function comparaisonConstante(a, b) {

  if (a.length !== b.length) {

    return false;

  }



  let difference = 0;



  for (

    let i = 0;

    i < a.length;

    i++

  ) {

    difference |=

      a[i] ^ b[i];

  }



  return difference === 0;

}



function creerCodeRecuperation() {

  const alphabet =

    "0123456789ABCDEFGHJKMNPQRSTVWXYZ";



  const octets =

    new Uint8Array(32);



  crypto.getRandomValues(octets);



  let codeBrut = "";



  for (const octet of octets) {

    codeBrut +=

      alphabet[octet & 31];

  }



  return codeBrut

    .match(/.{4}/g)

    .join("-");

}



function creerJetonSession() {

  const octets =

    new Uint8Array(32);



  crypto.getRandomValues(octets);



  return octetsVersBase64Url(

    octets

  );

}



function lireCookies(request) {

  const entete =

    request.headers.get(

      "Cookie"

    );



  if (!entete) {

    return {};

  }



  const cookies = {};



  for (

    const morceau of

    entete.split(";")

  ) {

    const index =

      morceau.indexOf("=");



    if (index === -1) {

      continue;

    }



    const nom =

      morceau

        .slice(0, index)

        .trim();



    const valeur =

      morceau

        .slice(index + 1)

        .trim();



    cookies[nom] = valeur;

  }



  return cookies;

}



async function sha256(texte) {

  const donnees =

    new TextEncoder().encode(

      texte

    );



  const resultat =

    await crypto.subtle.digest(

      "SHA-256",

      donnees

    );



  return Array.from(

    new Uint8Array(resultat)

  )

    .map((octet) =>

      octet

        .toString(16)

        .padStart(2, "0")

    )

    .join("");

}



async function creerCleRateLimit(

  request,

  pseudoNormalise

) {

  const ip =

    request.headers.get(

      "CF-Connecting-IP"

    ) || "ip-inconnue";



  return await sha256(

    `${pseudoNormalise}|${ip}`

  );

}



async function hasherMotDePasse(

  motDePasse

) {

  const iterations = PBKDF2_ITERATIONS_COURANTES;



  const sel =

    new Uint8Array(16);



  crypto.getRandomValues(sel);



  const cle =

    await crypto.subtle.importKey(

      "raw",

      new TextEncoder().encode(

        motDePasse

      ),

      "PBKDF2",

      false,

      ["deriveBits"]

    );



  const resultat =

    await crypto.subtle.deriveBits(

      {

        name: "PBKDF2",

        hash: "SHA-256",

        salt: sel,

        iterations,

      },

      cle,

      256

    );



  return [

    "pbkdf2_sha256",

    iterations,

    octetsVersBase64Url(sel),

    octetsVersBase64Url(

      new Uint8Array(

        resultat

      )

    ),

  ].join("$");

}



async function verifierMotDePasse(

  motDePasse,

  hashStocke

) {

  if (

    typeof hashStocke !==

      "string" ||

    !hashStocke.startsWith(

      "pbkdf2_sha256$"

    )

  ) {

    return false;

  }



  const morceaux =

    hashStocke.split("$");



  if (morceaux.length !== 4) {

    return false;

  }



  const iterations =

    Number(morceaux[1]);



  if (

    !Number.isInteger(

      iterations

    ) ||

    iterations < PBKDF2_ITERATIONS_LEGACY_MIN ||

    iterations > PBKDF2_ITERATIONS_MAX_ACCEPTEES

  ) {

    return false;

  }



  let sel;

  let hashAttendu;



  try {

    sel =

      base64UrlVersOctets(

        morceaux[2]

      );



    hashAttendu =

      base64UrlVersOctets(

        morceaux[3]

      );

  } catch {

    return false;

  }



  const cle =

    await crypto.subtle.importKey(

      "raw",

      new TextEncoder().encode(

        motDePasse

      ),

      "PBKDF2",

      false,

      ["deriveBits"]

    );



  const resultat =

    await crypto.subtle.deriveBits(

      {

        name: "PBKDF2",

        hash: "SHA-256",

        salt: sel,

        iterations,

      },

      cle,

      hashAttendu.length * 8

    );



  return comparaisonConstante(

    new Uint8Array(resultat),

    hashAttendu

  );

}


function motDePasseDoitEtreRehashe(hashStocke) {
  if (
    typeof hashStocke !== "string" ||
    !hashStocke.startsWith("pbkdf2_sha256$")
  ) {
    return false;
  }

  const iterations = Number(hashStocke.split("$")[1]);
  return Number.isInteger(iterations) && iterations < PBKDF2_ITERATIONS_COURANTES;
}



/**
 * Lit max-age dans Cache-Control afin de respecter la rotation
 * des clés publiques Google.
 */

function dureeCacheDepuisEntete(cacheControl) {

  const match =

    String(cacheControl || "")

      .match(/max-age=(\d+)/i);



  if (!match) {

    return 3600;

  }



  const secondes =

    Number(match[1]);



  if (

    !Number.isFinite(secondes) ||

    secondes < 60

  ) {

    return 3600;

  }



  return Math.min(

    secondes,

    86400

  );

}



async function obtenirGoogleJwks(force = false) {

  const maintenant =

    Date.now();



  if (

    !force &&

    cacheGoogleJwks.cles.length &&

    cacheGoogleJwks.expiration >

      maintenant

  ) {

    return cacheGoogleJwks.cles;

  }



  const response =

    await fetch(

      GOOGLE_JWKS_URL,

      {

        headers: {

          "Accept":

            "application/json",

        },

      }

    );



  if (!response.ok) {

    throw new Error(

      `JWKS Google indisponible (${response.status})`

    );

  }



  const payload =

    await response.json();



  if (

    !payload ||

    !Array.isArray(payload.keys)

  ) {

    throw new Error(

      "Réponse JWKS Google invalide"

    );

  }



  const maxAge =

    dureeCacheDepuisEntete(

      response.headers.get(

        "Cache-Control"

      )

    );



  cacheGoogleJwks = {

    expiration:

      maintenant +

      maxAge * 1000,

    cles:

      payload.keys,

  };



  return cacheGoogleJwks.cles;

}



async function importerCleGoogle(jwk) {

  return await crypto.subtle.importKey(

    "jwk",

    jwk,

    {

      name:

        "RSASSA-PKCS1-v1_5",

      hash:

        "SHA-256",

    },

    false,

    ["verify"]

  );

}



async function verifierJetonGoogle(

  credential,

  env

) {

  if (

    typeof credential !==

      "string" ||

    credential.length < 100 ||

    credential.length > 10000

  ) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  const morceaux =

    credential.split(".");



  if (morceaux.length !== 3) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  let header;

  let payload;



  try {

    header =

      JSON.parse(

        base64UrlVersTexte(

          morceaux[0]

        )

      );



    payload =

      JSON.parse(

        base64UrlVersTexte(

          morceaux[1]

        )

      );

  } catch {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  if (

    header?.alg !== "RS256" ||

    typeof header?.kid !==

      "string"

  ) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  const clientId =

    String(

      env.GOOGLE_CLIENT_ID ||

      GOOGLE_CLIENT_ID_PAR_DEFAUT

    ).trim();



  if (!clientId) {

    throw new Error(

      "Configuration Google manquante."

    );

  }



  const maintenantSecondes =

    Math.floor(

      Date.now() / 1000

    );



  const audienceValide =

    Array.isArray(payload?.aud)

      ? payload.aud.includes(

          clientId

        )

      : payload?.aud ===

        clientId;



  if (!audienceValide) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }

  // Si Google fournit azp, il doit identifier ce client. Il devient
  // obligatoire lorsqu'un token annonce plusieurs audiences.
  if (
    (payload?.azp != null && payload.azp !== clientId) ||
    (Array.isArray(payload?.aud) && payload.aud.length > 1 && payload?.azp !== clientId)
  ) {
    throw new Error("Connexion Google invalide ou expirée.");
  }



  if (

    payload?.iss !==

      "https://accounts.google.com" &&

    payload?.iss !==

      "accounts.google.com"

  ) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  if (

    !Number.isFinite(

      Number(payload?.exp)

    ) ||

    Number(payload.exp) <=

      maintenantSecondes - 30

  ) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  if (

    payload?.nbf != null &&

    Number(payload.nbf) >

      maintenantSecondes + 60

  ) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  if (

    payload?.iat != null &&

    Number(payload.iat) >

      maintenantSecondes + 300

  ) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  if (

    typeof payload?.sub !==

      "string" ||

    payload.sub.length < 3 ||

    payload.sub.length > 255

  ) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  let cles =

    await obtenirGoogleJwks(

      false

    );



  let jwk =

    cles.find(

      cle =>

        cle.kid === header.kid

    );



  if (!jwk) {

    cles =

      await obtenirGoogleJwks(

        true

      );



    jwk =

      cles.find(

        cle =>

          cle.kid === header.kid

      );

  }



  if (!jwk) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }

  if (
    jwk.kty !== "RSA" ||
    (jwk.use != null && jwk.use !== "sig") ||
    (jwk.alg != null && jwk.alg !== "RS256")
  ) {
    throw new Error("Connexion Google invalide ou expirée.");
  }



  const cleCrypto =

    await importerCleGoogle(

      jwk

    );



  const donneesSignees =

    new TextEncoder().encode(

      `${morceaux[0]}.${morceaux[1]}`

    );



  const signature =

    base64UrlVersOctets(

      morceaux[2]

    );



  const signatureValide =

    await crypto.subtle.verify(

      {

        name:

          "RSASSA-PKCS1-v1_5",

      },

      cleCrypto,

      signature,

      donneesSignees

    );



  if (!signatureValide) {

    throw new Error(

      "Connexion Google invalide ou expirée."

    );

  }



  return {

    sub:

      payload.sub,

  };

}



async function obtenirInfosCompte(env, utilisateurId) {
  const row = await env.db.prepare(`
    SELECT
      utilisateurs.id,
      utilisateurs.pseudo,
      utilisateurs.type_compte,
      utilisateurs.premium_jusqu_a,
      utilisateurs.date_changement_pseudo,
      CASE WHEN utilisateurs.hash_mot_de_passe IS NULL THEN 0 ELSE 1 END AS a_mot_de_passe,
      CASE WHEN comptes_google.id IS NULL THEN 0 ELSE 1 END AS google_lie,
      EXISTS (
        SELECT 1 FROM acceptations_legales a
        WHERE a.utilisateur_id = utilisateurs.id
          AND a.type_document = 'CGU'
          AND a.version_document = ?
      ) AS cgu_a_jour,
      EXISTS (
        SELECT 1 FROM acceptations_legales a
        WHERE a.utilisateur_id = utilisateurs.id
          AND a.type_document = 'AGE_18'
          AND a.version_document = ?
      ) AS age_a_jour
    FROM utilisateurs
    LEFT JOIN comptes_google ON comptes_google.utilisateur_id = utilisateurs.id
    WHERE utilisateurs.id = ?
      AND utilisateurs.date_suppression IS NULL
    LIMIT 1
  `).bind(
    VERSION_JURIDIQUE_COMPTE,
    VERSION_JURIDIQUE_COMPTE,
    utilisateurId
  ).first();

  if (!row) return null;

  return {
    id: row.id,
    pseudo: row.pseudo,
    typeCompte: estPremiumActif(row.premium_jusqu_a) ? "premium" : "gratuit",
    premiumJusquA: row.premium_jusqu_a,
    aMotDePasse: Boolean(row.a_mot_de_passe),
    googleLie: Boolean(row.google_lie),
    prochainChangementPseudoA: prochainChangementPseudo(row.date_changement_pseudo),
    conditionsCompteAJour: Boolean(row.cgu_a_jour) && Boolean(row.age_a_jour),
  };
}


async function creerSessionPourUtilisateur(

  env,

  utilisateurId

) {

  const jeton =

    creerJetonSession();



  const hashJeton =

    await sha256(jeton);



  const maintenant =

    Date.now();



  const dureeSessionSecondes =

    30 * 24 * 60 * 60;



  const expiration =

    maintenant +

    dureeSessionSecondes *

      1000;



  await env.db

    .prepare(

      `

      INSERT INTO sessions (

        id,

        utilisateur_id,

        hash_jeton,

        date_creation,

        date_expiration,

        derniere_utilisation

      )

      VALUES (

        ?,

        ?,

        ?,

        ?,

        ?,

        ?

      )

      `

    )

    .bind(

      crypto.randomUUID(),

      utilisateurId,

      hashJeton,

      maintenant,

      expiration,

      maintenant

    )

    .run();



  return {

    jeton,

    dureeSessionSecondes,

  };

}



async function obtenirSession(request, env) {
  const cookies = lireCookies(request);
  const jeton = cookies.clu_session;
  if (!jeton) return null;

  const hashJeton = await sha256(jeton);
  const maintenant = Date.now();

  const session = await env.db.prepare(`
    SELECT
      sessions.id AS session_id,
      sessions.utilisateur_id,
      sessions.date_expiration,
      utilisateurs.pseudo,
      utilisateurs.type_compte,
      utilisateurs.premium_jusqu_a,
      utilisateurs.date_changement_pseudo,
      CASE WHEN utilisateurs.hash_mot_de_passe IS NULL THEN 0 ELSE 1 END AS a_mot_de_passe,
      CASE WHEN comptes_google.id IS NULL THEN 0 ELSE 1 END AS google_lie,
      EXISTS (
        SELECT 1 FROM acceptations_legales a
        WHERE a.utilisateur_id = utilisateurs.id
          AND a.type_document = 'CGU'
          AND a.version_document = ?
      ) AS cgu_a_jour,
      EXISTS (
        SELECT 1 FROM acceptations_legales a
        WHERE a.utilisateur_id = utilisateurs.id
          AND a.type_document = 'AGE_18'
          AND a.version_document = ?
      ) AS age_a_jour
    FROM sessions
    INNER JOIN utilisateurs ON utilisateurs.id = sessions.utilisateur_id
    LEFT JOIN comptes_google ON comptes_google.utilisateur_id = utilisateurs.id
    WHERE sessions.hash_jeton = ?
      AND utilisateurs.date_suppression IS NULL
    LIMIT 1
  `).bind(
    VERSION_JURIDIQUE_COMPTE,
    VERSION_JURIDIQUE_COMPTE,
    hashJeton
  ).first();

  if (!session) return null;

  if (session.date_expiration <= maintenant) {
    await env.db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(session.session_id).run();
    return null;
  }

  return session;
}


async function inscription(request, env) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const pseudo = typeof corps.pseudo === "string" ? corps.pseudo.trim() : "";
  const motDePasse = typeof corps.motDePasse === "string" ? corps.motDePasse : "";

  if (pseudo.length < 3 || pseudo.length > 24) {
    return reponseJson({ ok: false, erreur: "Le pseudonyme doit contenir entre 3 et 24 caractères." }, 400);
  }
  if (motDePasse.length < 10 || motDePasse.length > 128) {
    return reponseJson({ ok: false, erreur: "Le mot de passe doit contenir entre 10 et 128 caractères." }, 400);
  }
  if (corps.accepteCgu !== true || corps.confirmeMajeur !== true) {
    return reponseJson({ ok: false, erreur: "Vous devez accepter les conditions d’utilisation et confirmer avoir au moins 18 ans." }, 400);
  }

  // L'inscription déclenche un hash de mot de passe coûteux et des écritures
  // D1. On limite donc les créations par IP avant ces opérations.
  try {
    const limiteInscription = await env.RATE_LIMIT_CONNEXION.limit({
      key: await creerCleRateLimit(request, "inscription"),
    });
    if (!limiteInscription.success) return reponseTropDeTentatives();
  } catch (erreur) {
    console.error("Erreur rate limiter inscription :", erreur);
    return reponseJson({ ok: false, erreur: "Le service d’inscription est temporairement indisponible." }, 503);
  }

  const pseudoNormalise = normaliserPseudo(pseudo);
  const utilisateurExistant = await env.db.prepare(`
    SELECT id FROM utilisateurs WHERE pseudo_normalise = ? LIMIT 1
  `).bind(pseudoNormalise).first();
  if (utilisateurExistant) {
    return reponseJson({ ok: false, erreur: "Ce pseudonyme est déjà utilisé." }, 409);
  }

  const utilisateurId = crypto.randomUUID();
  const codeRecuperationId = crypto.randomUUID();
  const maintenant = Date.now();
  const hashMotDePasse = await hasherMotDePasse(motDePasse);
  const codeRecuperation = creerCodeRecuperation();
  const hashCodeRecuperation = await sha256(codeRecuperation);

  try {
    await env.db.batch([
      env.db.prepare(`
        INSERT INTO utilisateurs (
          id, pseudo, pseudo_normalise, hash_mot_de_passe, type_compte,
          premium_jusqu_a, date_creation, date_modification, date_suppression,
          date_changement_pseudo
        ) VALUES (?, ?, ?, ?, 'gratuit', NULL, ?, ?, NULL, NULL)
      `).bind(utilisateurId, pseudo, pseudoNormalise, hashMotDePasse, maintenant, maintenant),
      env.db.prepare(`
        INSERT INTO codes_recuperation (
          id, utilisateur_id, hash_code, date_creation, date_utilisation
        ) VALUES (?, ?, ?, ?, NULL)
      `).bind(codeRecuperationId, utilisateurId, hashCodeRecuperation, maintenant),
      env.db.prepare(`
        INSERT INTO acceptations_legales (
          id, utilisateur_id, type_document, version_document, date_acceptation
        ) VALUES (?, ?, 'CGU', ?, ?)
      `).bind(crypto.randomUUID(), utilisateurId, VERSION_JURIDIQUE_COMPTE, maintenant),
      env.db.prepare(`
        INSERT INTO acceptations_legales (
          id, utilisateur_id, type_document, version_document, date_acceptation
        ) VALUES (?, ?, 'AGE_18', ?, ?)
      `).bind(crypto.randomUUID(), utilisateurId, VERSION_JURIDIQUE_COMPTE, maintenant),
    ]);
  } catch (erreur) {
    console.error("Erreur inscription :", erreur);
    return reponseJson({ ok: false, erreur: "Impossible de créer le compte." }, 500);
  }

  return reponseJson({
    ok: true,
    utilisateur: {
      id: utilisateurId,
      pseudo,
      typeCompte: "gratuit",
      premiumJusquA: null,
      aMotDePasse: true,
      googleLie: false,
      prochainChangementPseudoA: null,
      conditionsCompteAJour: true,
    },
    codeRecuperation,
    avertissement: "Conservez ce code de récupération dans un endroit sûr. CLU ne pourra pas vous le réafficher.",
  }, 201);
}


async function connexion(

  request,

  env

) {

  let corps;



  try {

    corps =

      await request.json();

  } catch {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le corps de la requête doit être au format JSON.",

      },

      400

    );

  }



  const pseudo =

    typeof corps.pseudo ===

    "string"

      ? corps.pseudo.trim()

      : "";



  const motDePasse =

    typeof corps.motDePasse ===

    "string"

      ? corps.motDePasse

      : "";



  if (

    !pseudo ||

    !motDePasse

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Pseudonyme et mot de passe requis.",

      },

      400

    );

  }

  if (pseudo.length > 24 || motDePasse.length > 128) {
    return reponseJson(
      { ok: false, erreur: "Pseudonyme ou mot de passe incorrect." },
      401
    );
  }



  const pseudoNormalise =

    normaliserPseudo(pseudo);



  const cleRateLimit =

    await creerCleRateLimit(

      request,

      pseudoNormalise

    );



  let limiteConnexion;



  try {

    limiteConnexion =

      await env

        .RATE_LIMIT_CONNEXION

        .limit({

          key:

            cleRateLimit,

        });

  } catch (erreur) {

    console.error(

      "Erreur rate limiter connexion :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Le service de connexion est temporairement indisponible.",

      },

      503

    );

  }



  if (

    !limiteConnexion.success

  ) {

    return reponseTropDeTentatives();

  }



  const utilisateur =

    await env.db

      .prepare(

        `

        SELECT

          id,

          pseudo,

          hash_mot_de_passe,

          type_compte,

          premium_jusqu_a



        FROM utilisateurs



        WHERE pseudo_normalise = ?

          AND date_suppression IS NULL



        LIMIT 1

        `

      )

      .bind(

        pseudoNormalise

      )

      .first();



  if (!utilisateur) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Pseudonyme ou mot de passe incorrect.",

      },

      401

    );

  }



  const motDePasseValide =

    await verifierMotDePasse(

      motDePasse,

      utilisateur

        .hash_mot_de_passe

    );



  if (

    !motDePasseValide

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Pseudonyme ou mot de passe incorrect.",

      },

      401

    );

  }

  if (motDePasseDoitEtreRehashe(utilisateur.hash_mot_de_passe)) {
    try {
      const hashRenforce = await hasherMotDePasse(motDePasse);
      await env.db.prepare(`
        UPDATE utilisateurs
        SET hash_mot_de_passe = ?, date_modification = ?
        WHERE id = ? AND date_suppression IS NULL
      `).bind(hashRenforce, Date.now(), utilisateur.id).run();
    } catch (erreur) {
      // Une panne du rehash opportuniste ne doit pas refuser une connexion
      // dont le mot de passe vient d'être correctement vérifié.
      console.error("Erreur rehash mot de passe :", erreur);
    }
  }



  const jeton =

    creerJetonSession();



  const hashJeton =

    await sha256(jeton);



  const maintenant =

    Date.now();



  const dureeSessionSecondes =

    30 * 24 * 60 * 60;



  const expiration =

    maintenant +

    dureeSessionSecondes *

      1000;



  try {

    await env.db

      .prepare(

        `

        INSERT INTO sessions (

          id,

          utilisateur_id,

          hash_jeton,

          date_creation,

          date_expiration,

          derniere_utilisation

        )

        VALUES (

          ?,

          ?,

          ?,

          ?,

          ?,

          ?

        )

        `

      )

      .bind(

        crypto.randomUUID(),

        utilisateur.id,

        hashJeton,

        maintenant,

        expiration,

        maintenant

      )

      .run();

  } catch (erreur) {

    console.error(

      "Erreur création session :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Impossible d'ouvrir la session.",

      },

      500

    );

  }



  const compte =

    await obtenirInfosCompte(

      env,

      utilisateur.id

    );



  if (!compte) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Compte introuvable.",

      },

      500

    );

  }



  return reponseJson(

    {

      ok: true,



      utilisateur:

        compte,

    },

    200,

    {

      "Set-Cookie": [

        `clu_session=${jeton}`,

        "HttpOnly",

        "Secure",

        "SameSite=Lax",

        "Path=/",

        `Max-Age=${dureeSessionSecondes}`,

      ].join("; "),

    }

  );

}



async function connexionGoogle(

  request,

  env

) {

  let corps;



  try {

    corps =

      await request.json();

  } catch {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le corps de la requête doit être au format JSON.",

      },

      400

    );

  }

  // Limite les validations JWT coûteuses avant même de contacter/consulter
  // les clés Google. Le contrôle par compte reste appliqué après validation.
  try {
    const limiteGooglePreauth = await env.RATE_LIMIT_CONNEXION.limit({
      key: await creerCleRateLimit(request, "google-preauth"),
    });
    if (!limiteGooglePreauth.success) return reponseTropDeTentatives();
  } catch (erreur) {
    console.error("Erreur rate limiter pré-auth Google :", erreur);
    return reponseJson({ ok: false, erreur: "Le service de connexion est temporairement indisponible." }, 503);
  }



  let google;



  try {

    google =

      await verifierJetonGoogle(

        corps.credential,

        env

      );

  } catch (erreur) {

    console.error(

      "Jeton Google refusé :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Connexion Google invalide ou expirée.",

      },

      401

    );

  }



  const cleRateLimit =

    await creerCleRateLimit(

      request,

      `google:${google.sub}`

    );



  let limiteConnexion;



  try {

    limiteConnexion =

      await env

        .RATE_LIMIT_CONNEXION

        .limit({

          key:

            cleRateLimit,

        });

  } catch (erreur) {

    console.error(

      "Erreur rate limiter connexion Google :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Le service de connexion est temporairement indisponible.",

      },

      503

    );

  }



  if (

    !limiteConnexion.success

  ) {

    return reponseTropDeTentatives();

  }



  const liaison =

    await env.db

      .prepare(

        `

        SELECT

          utilisateurs.id



        FROM comptes_google



        INNER JOIN utilisateurs

          ON utilisateurs.id =

             comptes_google.utilisateur_id



        WHERE comptes_google.identifiant_google = ?

          AND utilisateurs.date_suppression IS NULL



        LIMIT 1

        `

      )

      .bind(

        google.sub

      )

      .first();



  if (!liaison) {

    return reponseJson({

      ok: true,

      lie: false,

    });

  }



  try {

    const session =

      await creerSessionPourUtilisateur(

        env,

        liaison.id

      );



    const compte =

      await obtenirInfosCompte(

        env,

        liaison.id

      );



    if (!compte) {

      return reponseJson(

        {

          ok: false,

          erreur:

            "Compte introuvable.",

        },

        404

      );

    }



    return reponseJson(

      {

        ok: true,

        lie: true,

        utilisateur:

          compte,

      },

      200,

      {

        "Set-Cookie":

          cookieSession(

            session.jeton,

            session.dureeSessionSecondes

          ),

      }

    );

  } catch (erreur) {

    console.error(

      "Erreur connexion Google :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Impossible d'ouvrir la session.",

      },

      500

    );

  }

}



async function inscriptionGoogle(request, env) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const pseudo = typeof corps.pseudo === "string" ? corps.pseudo.trim() : "";
  if (pseudo.length < 3 || pseudo.length > 24) {
    return reponseJson({ ok: false, erreur: "Le pseudonyme doit contenir entre 3 et 24 caractères." }, 400);
  }
  if (corps.accepteCgu !== true || corps.confirmeMajeur !== true) {
    return reponseJson({ ok: false, erreur: "Vous devez accepter les conditions d’utilisation et confirmer avoir au moins 18 ans." }, 400);
  }

  try {
    const limiteGooglePreauth = await env.RATE_LIMIT_CONNEXION.limit({
      key: await creerCleRateLimit(request, "google-preauth"),
    });
    if (!limiteGooglePreauth.success) return reponseTropDeTentatives();
  } catch (erreur) {
    console.error("Erreur rate limiter pré-auth inscription Google :", erreur);
    return reponseJson({ ok: false, erreur: "Le service de connexion est temporairement indisponible." }, 503);
  }

  let google;
  try {
    google = await verifierJetonGoogle(corps.credential, env);
  } catch (erreur) {
    console.error("Jeton Google refusé à l'inscription :", erreur);
    return reponseJson({ ok: false, erreur: "Connexion Google invalide ou expirée." }, 401);
  }

  const cleRateLimit = await creerCleRateLimit(request, `google:${google.sub}`);
  let limiteConnexion;
  try {
    limiteConnexion = await env.RATE_LIMIT_CONNEXION.limit({ key: cleRateLimit });
  } catch (erreur) {
    console.error("Erreur rate limiter inscription Google :", erreur);
    return reponseJson({ ok: false, erreur: "Le service de connexion est temporairement indisponible." }, 503);
  }
  if (!limiteConnexion.success) return reponseTropDeTentatives();

  const pseudoNormalise = normaliserPseudo(pseudo);
  const pseudoExistant = await env.db.prepare(`
    SELECT id FROM utilisateurs WHERE pseudo_normalise = ? LIMIT 1
  `).bind(pseudoNormalise).first();
  if (pseudoExistant) {
    return reponseJson({ ok: false, erreur: "Ce pseudonyme est déjà utilisé." }, 409);
  }

  const googleExistant = await env.db.prepare(`
    SELECT utilisateur_id FROM comptes_google WHERE identifiant_google = ? LIMIT 1
  `).bind(google.sub).first();
  if (googleExistant) {
    return reponseJson({ ok: false, erreur: "Ce compte Google est déjà lié à un compte CLU." }, 409);
  }

  const utilisateurId = crypto.randomUUID();
  const maintenant = Date.now();
  const codeRecuperation = creerCodeRecuperation();
  const hashCodeRecuperation = await sha256(codeRecuperation);

  try {
    await env.db.batch([
      env.db.prepare(`
        INSERT INTO utilisateurs (
          id, pseudo, pseudo_normalise, hash_mot_de_passe, type_compte,
          premium_jusqu_a, date_creation, date_modification, date_suppression,
          date_changement_pseudo
        ) VALUES (?, ?, ?, NULL, 'gratuit', NULL, ?, ?, NULL, NULL)
      `).bind(utilisateurId, pseudo, pseudoNormalise, maintenant, maintenant),
      env.db.prepare(`
        INSERT INTO codes_recuperation (
          id, utilisateur_id, hash_code, date_creation, date_utilisation
        ) VALUES (?, ?, ?, ?, NULL)
      `).bind(crypto.randomUUID(), utilisateurId, hashCodeRecuperation, maintenant),
      env.db.prepare(`
        INSERT INTO comptes_google (
          id, utilisateur_id, identifiant_google, date_creation
        ) VALUES (?, ?, ?, ?)
      `).bind(crypto.randomUUID(), utilisateurId, google.sub, maintenant),
      env.db.prepare(`
        INSERT INTO acceptations_legales (
          id, utilisateur_id, type_document, version_document, date_acceptation
        ) VALUES (?, ?, 'CGU', ?, ?)
      `).bind(crypto.randomUUID(), utilisateurId, VERSION_JURIDIQUE_COMPTE, maintenant),
      env.db.prepare(`
        INSERT INTO acceptations_legales (
          id, utilisateur_id, type_document, version_document, date_acceptation
        ) VALUES (?, ?, 'AGE_18', ?, ?)
      `).bind(crypto.randomUUID(), utilisateurId, VERSION_JURIDIQUE_COMPTE, maintenant),
    ]);

    const session = await creerSessionPourUtilisateur(env, utilisateurId);
    const compte = await obtenirInfosCompte(env, utilisateurId);
    if (!compte) throw new Error("Compte Google créé mais introuvable.");

    return reponseJson({
      ok: true,
      utilisateur: compte,
      codeRecuperation,
      avertissement: "Conservez ce code de récupération dans un endroit sûr. CLU ne pourra pas vous le réafficher.",
    }, 201, {
      "Set-Cookie": cookieSession(session.jeton, session.dureeSessionSecondes),
    });
  } catch (erreur) {
    console.error("Erreur inscription Google :", erreur);
    return reponseJson({ ok: false, erreur: "Impossible de créer le compte." }, 500);
  }
}


async function lierGoogle(

  request,

  env

) {

  const session =

    await obtenirSession(

      request,

      env

    );



  if (!session) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Vous devez être connecté.",

      },

      401,

      {

        "Set-Cookie":

          cookieSessionExpire(),

      }

    );

  }



  let corps;



  try {

    corps =

      await request.json();

  } catch {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le corps de la requête doit être au format JSON.",

      },

      400

    );

  }



  let google;



  try {

    google =

      await verifierJetonGoogle(

        corps.credential,

        env

      );

  } catch (erreur) {

    console.error(

      "Jeton Google refusé à la liaison :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Connexion Google invalide ou expirée.",

      },

      401

    );

  }



  const liaisonGoogle =

    await env.db

      .prepare(

        `

        SELECT utilisateur_id

        FROM comptes_google

        WHERE identifiant_google = ?

        LIMIT 1

        `

      )

      .bind(

        google.sub

      )

      .first();



  if (

    liaisonGoogle &&

    liaisonGoogle.utilisateur_id !==

      session.utilisateur_id

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Ce compte Google est déjà lié à un autre compte CLU.",

      },

      409

    );

  }



  const liaisonUtilisateur =

    await env.db

      .prepare(

        `

        SELECT identifiant_google

        FROM comptes_google

        WHERE utilisateur_id = ?

        LIMIT 1

        `

      )

      .bind(

        session.utilisateur_id

      )

      .first();



  if (liaisonUtilisateur) {

    if (

      liaisonUtilisateur

        .identifiant_google ===

      google.sub

    ) {

      const compte =

        await obtenirInfosCompte(

          env,

          session.utilisateur_id

        );



      return reponseJson({

        ok: true,

        googleLie: true,

        utilisateur:

          compte,

      });

    }



    return reponseJson(

      {

        ok: false,

        erreur:

          "Un compte Google est déjà lié à ce compte CLU.",

      },

      409

    );

  }



  try {

    await env.db

      .prepare(

        `

        INSERT INTO comptes_google (

          id,

          utilisateur_id,

          identifiant_google,

          date_creation

        )

        VALUES (

          ?,

          ?,

          ?,

          ?

        )

        `

      )

      .bind(

        crypto.randomUUID(),

        session.utilisateur_id,

        google.sub,

        Date.now()

      )

      .run();



    const compte =

      await obtenirInfosCompte(

        env,

        session.utilisateur_id

      );



    return reponseJson({

      ok: true,

      googleLie: true,

      utilisateur:

        compte,

    });

  } catch (erreur) {

    console.error(

      "Erreur liaison Google :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Impossible de lier le compte Google.",

      },

      500

    );

  }

}



function origineRetourCheckout(request) {

  const origine =
    request.headers.get("Origin");

  if (
    origine &&
    ORIGINES_AUTORISEES.has(origine)
  ) {

    return origine;

  }



  const referer =
    request.headers.get("Referer");

  if (referer) {

    try {

      const origineReferer =
        new URL(referer).origin;

      if (
        ORIGINES_AUTORISEES.has(
          origineReferer
        ) ||
        origineReferer ===
          "http://localhost:3000"
      ) {

        return origineReferer;

      }

    } catch {

      // Retour de production par défaut.

    }

  }



  return "https://useclu.pro";

}



function chaineHexDepuisOctets(octets) {

  return Array.from(octets)
    .map((octet) =>
      octet
        .toString(16)
        .padStart(2, "0")
    )
    .join("");

}



function comparaisonTexteConstante(a, b) {

  const texteA =
    String(a || "").toLowerCase();

  const texteB =
    String(b || "").toLowerCase();

  if (
    texteA.length !==
    texteB.length
  ) {

    return false;

  }

  let difference = 0;

  for (
    let i = 0;
    i < texteA.length;
    i++
  ) {

    difference |=
      texteA.charCodeAt(i) ^
      texteB.charCodeAt(i);

  }

  return difference === 0;

}



async function hmacSha256Hex(

  secret,

  message

) {

  const encodeur =
    new TextEncoder();

  const cle =
    await crypto.subtle.importKey(
      "raw",
      encodeur.encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      cle,
      encodeur.encode(message)
    );

  return chaineHexDepuisOctets(
    new Uint8Array(signature)
  );

}



function parserEnteteSignatureStripe(entete) {

  const morceaux =
    String(entete || "")
      .split(",")
      .map((morceau) =>
        morceau.trim()
      )
      .filter(Boolean);

  let timestamp = null;
  const signatures = [];

  for (const morceau of morceaux) {

    const index =
      morceau.indexOf("=");

    if (index <= 0) {

      continue;

    }

    const cle =
      morceau
        .slice(0, index)
        .trim();

    const valeur =
      morceau
        .slice(index + 1)
        .trim();

    if (
      cle === "t" &&
      timestamp === null
    ) {

      timestamp =
        Number(valeur);

    }

    if (
      cle === "v1" &&
      valeur
    ) {

      signatures.push(valeur);

    }

  }

  return {
    timestamp,
    signatures,
  };

}



async function verifierSignatureStripe(

  corpsBrut,

  enteteSignature,

  secretWebhook

) {

  if (
    typeof secretWebhook !== "string" ||
    !secretWebhook.trim()
  ) {

    throw new Error(
      "Secret webhook Stripe manquant."
    );

  }

  const resultat =
    parserEnteteSignatureStripe(
      enteteSignature
    );

  if (
    !Number.isFinite(
      resultat.timestamp
    ) ||
    !resultat.signatures.length
  ) {

    return false;

  }

  const maintenantSecondes =
    Math.floor(
      Date.now() / 1000
    );

  if (
    Math.abs(
      maintenantSecondes -
      resultat.timestamp
    ) >
    STRIPE_TOLERANCE_SIGNATURE_SECONDES
  ) {

    return false;

  }

  const contenuSigne =
    `${resultat.timestamp}.${corpsBrut}`;

  const signatureAttendue =
    await hmacSha256Hex(
      secretWebhook.trim(),
      contenuSigne
    );

  return resultat.signatures.some(
    (signature) =>
      comparaisonTexteConstante(
        signature,
        signatureAttendue
      )
  );

}



function configurationStripeValide(env) {

  return Boolean(
    String(
      env.STRIPE_SECRET_KEY || ""
    ).trim() &&
    String(
      env.STRIPE_PRICE_PREMIUM || ""
    ).trim()
  );

}



async function appelStripe(

  env,

  chemin,

  options = {}

) {

  const secret =
    String(
      env.STRIPE_SECRET_KEY || ""
    ).trim();

  if (!secret) {

    throw new Error(
      "Clé Stripe manquante."
    );

  }

  const headers =
    new Headers(
      options.headers || {}
    );

  headers.set(
    "Authorization",
    `Bearer ${secret}`
  );

  const response =
    await fetch(
      `${STRIPE_API_BASE_URL}${chemin}`,
      {
        ...options,
        headers,
      }
    );

  let payload = null;

  try {

    payload =
      await response.json();

  } catch {

    payload = null;

  }

  if (!response.ok) {

    const message =
      payload?.error?.message ||
      `Erreur Stripe (${response.status}).`;

    throw new Error(message);

  }

  if (!payload) {

    throw new Error(
      "Réponse Stripe invalide."
    );

  }

  return payload;

}



async function creerCheckoutPremium(request, env) {
  const session = await obtenirSession(request, env);
  if (!session) {
    return reponseJson({ ok: false, erreur: "Vous devez être connecté." }, 401, {
      "Set-Cookie": cookieSessionExpire(),
    });
  }
  if (!configurationStripeValide(env)) {
    return reponseJson({ ok: false, erreur: "Le paiement Premium n'est pas encore configuré." }, 503);
  }

  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Les confirmations Premium sont requises." }, 400);
  }

  if (
    corps.accepteCgu !== true ||
    corps.confirmeMajeur !== true ||
    corps.accepteConditionsPremium !== true ||
    corps.demandeActivationImmediate !== true
  ) {
    return reponseJson({
      ok: false,
      erreur: "Vous devez accepter les conditions Premium, les CGU, confirmer avoir 18 ans et demander l’activation immédiate.",
    }, 400);
  }

  const cleRateLimit = await creerCleRateLimit(request, `premium:${session.utilisateur_id}`);
  let limiteCheckout;
  try {
    limiteCheckout = await env.RATE_LIMIT_CONNEXION.limit({ key: cleRateLimit });
  } catch (erreur) {
    console.error("Erreur rate limiter Premium :", erreur);
    return reponseJson({ ok: false, erreur: "Le service Premium est temporairement indisponible." }, 503);
  }
  if (!limiteCheckout.success) return reponseTropDeTentatives();

  try {
    await enregistrerAcceptationsLegales(env, session.utilisateur_id, [
      { type: "CGU", version: VERSION_JURIDIQUE_COMPTE },
      { type: "AGE_18", version: VERSION_JURIDIQUE_COMPTE },
      { type: "CONDITIONS_PREMIUM", version: VERSION_JURIDIQUE_PREMIUM },
      { type: "ACTIVATION_IMMEDIATE", version: VERSION_JURIDIQUE_PREMIUM },
    ]);
  } catch (erreur) {
    console.error("Erreur enregistrement acceptations Premium :", erreur);
    return reponseJson({ ok: false, erreur: "Impossible d’enregistrer les confirmations juridiques." }, 500);
  }

  const origineRetour = origineRetourCheckout(request);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price]", String(env.STRIPE_PRICE_PREMIUM).trim());
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", session.utilisateur_id);
  params.set("customer_creation", "always");
  params.set("metadata[utilisateur_id]", session.utilisateur_id);
  params.set("metadata[offre]", STRIPE_OFFRE_PREMIUM);
  params.set("metadata[version_juridique]", VERSION_JURIDIQUE_PREMIUM);
  params.set("payment_intent_data[metadata][utilisateur_id]", session.utilisateur_id);
  params.set("payment_intent_data[metadata][offre]", STRIPE_OFFRE_PREMIUM);
  params.set("payment_intent_data[metadata][version_juridique]", VERSION_JURIDIQUE_PREMIUM);
  params.set("success_url", `${origineRetour}/game?premium=succes&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origineRetour}/game?premium=annule`);

  try {
    const checkout = await appelStripe(env, "/checkout/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (typeof checkout?.id !== "string" || typeof checkout?.url !== "string") {
      throw new Error("Session Checkout Stripe invalide.");
    }

    return reponseJson({ ok: true, sessionId: checkout.id, url: checkout.url });
  } catch (erreur) {
    console.error("Erreur création Checkout Premium :", erreur);
    return reponseJson({ ok: false, erreur: "Impossible d'ouvrir le paiement Premium." }, 502);
  }
}


function modeStripeCorrespond(

  env,

  evenement

) {

  const secret =
    String(
      env.STRIPE_SECRET_KEY || ""
    ).trim();

  if (
    secret.startsWith("sk_test_")
  ) {

    return evenement?.livemode === false;

  }

  if (
    secret.startsWith("sk_live_")
  ) {

    return evenement?.livemode === true;

  }

  return true;

}



async function activerPremiumDepuisCheckout(env, checkout, dateConfirmation = Date.now()) {
  if (!checkout || checkout.object !== "checkout.session" || checkout.mode !== "payment" || checkout.payment_status !== "paid") {
    return { traite: false, raison: "paiement_non_confirme" };
  }

  const utilisateurId = String(checkout.metadata?.utilisateur_id || checkout.client_reference_id || "").trim();
  const offre = String(checkout.metadata?.offre || "").trim();
  if (!utilisateurId || offre !== STRIPE_OFFRE_PREMIUM) {
    throw new Error("Métadonnées Premium Stripe invalides.");
  }
  if (
    Number(checkout.amount_total) !== STRIPE_MONTANT_PREMIUM_CENTIMES ||
    String(checkout.currency || "").toLowerCase() !== STRIPE_DEVISE_PREMIUM
  ) {
    throw new Error("Montant ou devise Stripe inattendu.");
  }

  const utilisateur = await env.db.prepare(`
    SELECT id, premium_jusqu_a
    FROM utilisateurs
    WHERE id = ? AND date_suppression IS NULL
    LIMIT 1
  `).bind(utilisateurId).first();
  if (!utilisateur) throw new Error("Utilisateur Premium introuvable.");

  const maintenant = Date.now();
  const confirmation = Number(dateConfirmation);
  const datePromo = Number.isFinite(confirmation) && confirmation > 0 ? confirmation : maintenant;
  const expirationActuelle = Number(utilisateur.premium_jusqu_a);
  const premiumDebut = Number.isFinite(expirationActuelle) && expirationActuelle > maintenant
    ? expirationActuelle
    : maintenant;
  const moisAccordes = moisPremiumPourDate(datePromo);
  const premiumFin = ajouterMoisPremiumUTC(premiumDebut, moisAccordes);
  const paiementId = crypto.randomUUID();
  const stripeSessionId = String(checkout.id || "").trim();
  const stripePaiementId = typeof checkout.payment_intent === "string"
    ? checkout.payment_intent
    : checkout.payment_intent?.id || null;

  if (!stripeSessionId) throw new Error("Session Stripe sans identifiant.");

  const resultats = await env.db.batch([
    env.db.prepare(`
      INSERT OR IGNORE INTO paiements_premium (
        id, utilisateur_id, stripe_session_id, stripe_paiement_id,
        montant_centimes, devise, premium_debut, premium_fin, date_creation,
        montant_rembourse_centimes, date_dernier_remboursement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
    `).bind(
      paiementId,
      utilisateurId,
      stripeSessionId,
      stripePaiementId,
      Number(checkout.amount_total),
      String(checkout.currency).toLowerCase(),
      premiumDebut,
      premiumFin,
      maintenant
    ),
    env.db.prepare(`
      UPDATE utilisateurs
      SET type_compte = 'premium', premium_jusqu_a = ?, date_modification = ?
      WHERE id = ?
        AND date_suppression IS NULL
        AND EXISTS (SELECT 1 FROM paiements_premium WHERE id = ?)
    `).bind(premiumFin, maintenant, utilisateurId, paiementId),
  ]);

  const paiementCree = Number(resultats?.[0]?.meta?.changes || 0) > 0;
  return {
    traite: true,
    nouveauPaiement: paiementCree,
    premiumJusquA: paiementCree ? premiumFin : utilisateur.premium_jusqu_a,
  };
}

async function recalculerPremiumDepuisPaiements(env, utilisateurId, maintenant = Date.now()) {
  const paiements = await env.db.prepare(`
    SELECT montant_centimes, montant_rembourse_centimes, date_creation, premium_debut, premium_fin
    FROM paiements_premium
    WHERE utilisateur_id = ?
    ORDER BY date_creation ASC
  `).bind(utilisateurId).all();

  let expiration = null;
  for (const paiement of paiements?.results || []) {
    const montant = Number(paiement.montant_centimes || 0);
    const rembourse = Number(paiement.montant_rembourse_centimes || 0);
    if (!Number.isFinite(montant) || montant <= 0 || rembourse >= montant) continue;

    const dateAchat = Number(paiement.date_creation);
    if (!Number.isFinite(dateAchat) || dateAchat <= 0) continue;
    const base = Number.isFinite(expiration) && expiration > dateAchat ? expiration : dateAchat;
    const debutHistorique = Number(paiement.premium_debut);
    const finHistorique = Number(paiement.premium_fin);
    let moisAccordes = 1;
    if (Number.isFinite(debutHistorique) && Number.isFinite(finHistorique)) {
      if (ajouterMoisPremiumUTC(debutHistorique, 2) === finHistorique) moisAccordes = 2;
    } else {
      moisAccordes = moisPremiumPourDate(dateAchat);
    }
    expiration = ajouterMoisPremiumUTC(base, moisAccordes);
  }

  if (!Number.isFinite(expiration) || expiration <= maintenant) {
    await env.db.prepare(`
      UPDATE utilisateurs
      SET type_compte = 'gratuit', premium_jusqu_a = NULL, date_modification = ?
      WHERE id = ? AND date_suppression IS NULL
    `).bind(maintenant, utilisateurId).run();
    return null;
  }

  await env.db.prepare(`
    UPDATE utilisateurs
    SET type_compte = 'premium', premium_jusqu_a = ?, date_modification = ?
    WHERE id = ? AND date_suppression IS NULL
  `).bind(expiration, maintenant, utilisateurId).run();
  return expiration;
}

async function traiterRemboursementStripe(env, charge) {
  if (!charge || charge.object !== "charge") return { traite: false };
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id || "";
  if (!paymentIntentId) return { traite: false };

  const paiement = await env.db.prepare(`
    SELECT id, utilisateur_id, montant_centimes, montant_rembourse_centimes
    FROM paiements_premium
    WHERE stripe_paiement_id = ?
    LIMIT 1
  `).bind(paymentIntentId).first();

  if (!paiement) {
    // Les livraisons webhook Stripe ne sont pas garanties dans l’ordre.
    // Si le remboursement concerne bien CLU mais que checkout.session.completed
    // n’a pas encore créé la ligne D1, on renvoie une erreur afin que Stripe réessaie.
    let paymentIntent = null;
    try {
      paymentIntent = await appelStripe(env, `/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
        method: "GET",
      });
    } catch (erreur) {
      console.error("Impossible de vérifier le PaymentIntent remboursé :", erreur);
    }

    const offre = String(paymentIntent?.metadata?.offre || charge.metadata?.offre || "").trim();
    if (offre === STRIPE_OFFRE_PREMIUM) {
      throw new Error("Paiement Premium remboursé introuvable dans D1 ; nouvel essai requis.");
    }

    return { traite: false, raison: "paiement_inconnu" };
  }

  const ancienRemboursement = Number(paiement.montant_rembourse_centimes || 0);
  const nouveauRemboursement = Math.max(0, Number(charge.amount_refunded || 0));
  const maintenant = Date.now();

  await env.db.prepare(`
    UPDATE paiements_premium
    SET montant_rembourse_centimes = ?, date_dernier_remboursement = ?
    WHERE id = ?
  `).bind(nouveauRemboursement, maintenant, paiement.id).run();

  const montantTotal = Number(paiement.montant_centimes || 0);
  const devientEntierementRembourse =
    ancienRemboursement < montantTotal &&
    nouveauRemboursement >= montantTotal;

  if (!devientEntierementRembourse) {
    return { traite: true, premiumRecalcule: false };
  }

  const premiumJusquA = await recalculerPremiumDepuisPaiements(
    env,
    paiement.utilisateur_id,
    maintenant
  );

  return {
    traite: true,
    premiumRecalcule: true,
    premiumJusquA,
  };
}

async function webhookStripe(request, env) {
  const secretWebhook = String(env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secretWebhook) {
    console.error("Webhook Stripe appelé sans STRIPE_WEBHOOK_SECRET.");
    return reponseJson({ ok: false, erreur: "Webhook Stripe non configuré." }, 503);
  }

  const enteteSignature = request.headers.get("Stripe-Signature");
  if (!enteteSignature) return reponseJson({ ok: false, erreur: "Signature Stripe manquante." }, 400);

  const corpsBrut = await request.text();
  let signatureValide = false;
  try {
    signatureValide = await verifierSignatureStripe(corpsBrut, enteteSignature, secretWebhook);
  } catch (erreur) {
    console.error("Erreur vérification signature Stripe :", erreur);
  }
  if (!signatureValide) return reponseJson({ ok: false, erreur: "Signature Stripe invalide." }, 400);

  let evenement;
  try {
    evenement = JSON.parse(corpsBrut);
  } catch {
    return reponseJson({ ok: false, erreur: "Événement Stripe invalide." }, 400);
  }

  if (!modeStripeCorrespond(env, evenement)) {
    console.error("Événement Stripe test/live incohérent.");
    return reponseJson({ ok: false, erreur: "Mode Stripe incohérent." }, 400);
  }

  const type = String(evenement?.type || "");
  try {
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const dateEvenement = Number(evenement?.created) * 1000;
      const resultat = await activerPremiumDepuisCheckout(
        env,
        evenement?.data?.object,
        Number.isFinite(dateEvenement) && dateEvenement > 0 ? dateEvenement : Date.now()
      );
      return reponseJson({
        ok: true,
        traite: resultat.traite,
        nouveauPaiement: resultat.nouveauPaiement || false,
      });
    }

    if (type === "charge.refunded") {
      const resultat = await traiterRemboursementStripe(env, evenement?.data?.object);
      return reponseJson({ ok: true, ...resultat });
    }

    return reponseJson({ ok: true, ignore: true });
  } catch (erreur) {
    console.error("Erreur traitement webhook Premium :", erreur);
    return reponseJson({ ok: false, erreur: "Impossible de traiter l'événement Stripe." }, 500);
  }
}


async function moi(request, env) {
  const session = await obtenirSession(request, env);
  if (!session) {
    return reponseJson({ ok: false, connecte: false }, 401, {
      "Set-Cookie": cookieSessionExpire(),
    });
  }

  return reponseJson({
    ok: true,
    connecte: true,
    utilisateur: {
      id: session.utilisateur_id,
      pseudo: session.pseudo,
      typeCompte: estPremiumActif(session.premium_jusqu_a) ? "premium" : "gratuit",
      premiumJusquA: session.premium_jusqu_a,
      aMotDePasse: Boolean(session.a_mot_de_passe),
      googleLie: Boolean(session.google_lie),
      prochainChangementPseudoA: prochainChangementPseudo(session.date_changement_pseudo),
      conditionsCompteAJour: Boolean(session.cgu_a_jour) && Boolean(session.age_a_jour),
    },
  });
}


async function deconnexion(

  request,

  env

) {

  const cookies =

    lireCookies(request);



  const jeton =

    cookies.clu_session;



  if (jeton) {

    const hashJeton =

      await sha256(jeton);



    await env.db

      .prepare(

        `

        DELETE FROM sessions

        WHERE hash_jeton = ?

        `

      )

      .bind(hashJeton)

      .run();

  }



  return reponseJson(

    {

      ok: true,

      deconnecte: true,

    },

    200,

    {

      "Set-Cookie":

        cookieSessionExpire(),

    }

  );

}



async function recuperationCompte(

  request,

  env

) {

  let corps;



  try {

    corps =

      await request.json();

  } catch {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le corps de la requête doit être au format JSON.",

      },

      400

    );

  }



  const pseudo =

    typeof corps.pseudo ===

    "string"

      ? corps.pseudo.trim()

      : "";



  const codeRecuperation =

    normaliserCodeRecuperation(

      corps.codeRecuperation

    );



  const nouveauMotDePasse =

    typeof corps

      .nouveauMotDePasse ===

    "string"

      ? corps

          .nouveauMotDePasse

      : "";



  if (

    !pseudo ||

    !codeRecuperation

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Pseudonyme et code de récupération requis.",

      },

      400

    );

  }



  if (

    nouveauMotDePasse.length <

      10 ||

    nouveauMotDePasse.length >

      128

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le nouveau mot de passe doit contenir entre 10 et 128 caractères.",

      },

      400

    );

  }



  const pseudoNormalise =

    normaliserPseudo(pseudo);



  const cleRateLimit =

    await creerCleRateLimit(

      request,

      pseudoNormalise

    );



  let limiteRecuperation;



  try {

    limiteRecuperation =

      await env

        .RATE_LIMIT_RECUPERATION

        .limit({

          key:

            cleRateLimit,

        });

  } catch (erreur) {

    console.error(

      "Erreur rate limiter récupération :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Le service de récupération est temporairement indisponible.",

      },

      503

    );

  }



  if (

    !limiteRecuperation.success

  ) {

    return reponseTropDeTentatives();

  }



  const utilisateur =

    await env.db

      .prepare(

        `

        SELECT

          utilisateurs.id,

          utilisateurs.pseudo,

          codes_recuperation.hash_code



        FROM utilisateurs



        INNER JOIN codes_recuperation

          ON codes_recuperation.utilisateur_id =

             utilisateurs.id



        WHERE utilisateurs.pseudo_normalise = ?

          AND utilisateurs.date_suppression IS NULL



        LIMIT 1

        `

      )

      .bind(

        pseudoNormalise

      )

      .first();



  if (!utilisateur) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Pseudonyme ou code de récupération incorrect.",

      },

      401

    );

  }



  const hashCodeFourni =

    await sha256(

      codeRecuperation

    );



  if (

    !comparaisonTexteConstante(
      hashCodeFourni,
      utilisateur.hash_code
    )

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Pseudonyme ou code de récupération incorrect.",

      },

      401

    );

  }



  const maintenant =

    Date.now();



  const nouveauHashMotDePasse =

    await hasherMotDePasse(

      nouveauMotDePasse

    );



  const nouveauCodeRecuperation =

    creerCodeRecuperation();



  const nouveauHashCode =

    await sha256(

      nouveauCodeRecuperation

    );



  try {

    await env.db.batch([

      env.db

        .prepare(

          `

          UPDATE utilisateurs



          SET

            hash_mot_de_passe = ?,

            date_modification = ?



          WHERE id = ?

            AND date_suppression IS NULL

          `

        )

        .bind(

          nouveauHashMotDePasse,

          maintenant,

          utilisateur.id

        ),



      env.db

        .prepare(

          `

          DELETE FROM sessions

          WHERE utilisateur_id = ?

          `

        )

        .bind(

          utilisateur.id

        ),



      env.db

        .prepare(

          `

          UPDATE codes_recuperation



          SET

            hash_code = ?,

            date_creation = ?,

            date_utilisation = NULL



          WHERE utilisateur_id = ?

          `

        )

        .bind(

          nouveauHashCode,

          maintenant,

          utilisateur.id

        ),

    ]);

  } catch (erreur) {

    console.error(

      "Erreur récupération compte :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Impossible de récupérer le compte.",

      },

      500

    );

  }



  return reponseJson({

    ok: true,

    compteRecupere: true,



    utilisateur: {

      id:

        utilisateur.id,



      pseudo:

        utilisateur.pseudo,

    },



    nouveauCodeRecuperation,



    avertissement:

      "Votre ancien code de récupération n'est plus valable. Conservez soigneusement ce nouveau code.",

  });

}



async function changerMotDePasse(

  request,

  env

) {

  const session =

    await obtenirSession(

      request,

      env

    );



  if (!session) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Vous devez être connecté.",

      },

      401,

      {

        "Set-Cookie":

          cookieSessionExpire(),

      }

    );

  }



  let corps;



  try {

    corps =

      await request.json();

  } catch {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le corps de la requête doit être au format JSON.",

      },

      400

    );

  }



  const motDePasseActuel =

    typeof corps

      .motDePasseActuel ===

    "string"

      ? corps.motDePasseActuel

      : "";



  const nouveauMotDePasse =

    typeof corps

      .nouveauMotDePasse ===

    "string"

      ? corps.nouveauMotDePasse

      : "";



  if (

    !motDePasseActuel ||

    !nouveauMotDePasse

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le mot de passe actuel et le nouveau mot de passe sont requis.",

      },

      400

    );

  }

  if (motDePasseActuel.length > 128) {
    return reponseJson({ ok: false, erreur: "Le mot de passe actuel est incorrect." }, 401);
  }



  if (

    nouveauMotDePasse.length <

      10 ||

    nouveauMotDePasse.length >

      128

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le nouveau mot de passe doit contenir entre 10 et 128 caractères.",

      },

      400

    );

  }



  if (

    motDePasseActuel ===

    nouveauMotDePasse

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le nouveau mot de passe doit être différent de l'ancien.",

      },

      400

    );

  }



  const utilisateur =

    await env.db

      .prepare(

        `

        SELECT

          id,

          hash_mot_de_passe



        FROM utilisateurs



        WHERE id = ?

          AND date_suppression IS NULL



        LIMIT 1

        `

      )

      .bind(

        session.utilisateur_id

      )

      .first();



  if (!utilisateur) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Compte introuvable.",

      },

      404,

      {

        "Set-Cookie":

          cookieSessionExpire(),

      }

    );

  }

  try {
    const limiteReauth = await env.RATE_LIMIT_CONNEXION.limit({
      key: await creerCleRateLimit(request, `reauth:${session.utilisateur_id}`),
    });
    if (!limiteReauth.success) return reponseTropDeTentatives();
  } catch (erreur) {
    console.error("Erreur rate limiter ré-authentification :", erreur);
    return reponseJson({ ok: false, erreur: "La vérification d’identité est temporairement indisponible." }, 503);
  }



  const valide =

    await verifierMotDePasse(

      motDePasseActuel,

      utilisateur

        .hash_mot_de_passe

    );



  if (!valide) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le mot de passe actuel est incorrect.",

      },

      401

    );

  }



  const nouveauHash =

    await hasherMotDePasse(

      nouveauMotDePasse

    );



  const maintenant =

    Date.now();



  try {

    await env.db.batch([

      env.db

        .prepare(

          `

          UPDATE utilisateurs



          SET

            hash_mot_de_passe = ?,

            date_modification = ?



          WHERE id = ?

            AND date_suppression IS NULL

          `

        )

        .bind(

          nouveauHash,

          maintenant,

          utilisateur.id

        ),



      env.db

        .prepare(

          `

          DELETE FROM sessions

          WHERE utilisateur_id = ?

          `

        )

        .bind(

          utilisateur.id

        ),

    ]);

  } catch (erreur) {

    console.error(

      "Erreur changement mot de passe :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Impossible de modifier le mot de passe.",

      },

      500

    );

  }



  return reponseJson(

    {

      ok: true,

      motDePasseModifie: true,

      deconnecte: true,



      message:

        "Le mot de passe a été modifié. Toutes les sessions ont été fermées. Reconnectez-vous avec le nouveau mot de passe.",

    },

    200,

    {

      "Set-Cookie":

        cookieSessionExpire(),

    }

  );

}



async function supprimerCompte(

  request,

  env

) {

  const session =

    await obtenirSession(

      request,

      env

    );



  if (!session) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Vous devez être connecté.",

      },

      401,

      {

        "Set-Cookie":

          cookieSessionExpire(),

      }

    );

  }



  let corps;



  try {

    corps =

      await request.json();

  } catch {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Le corps de la requête doit être au format JSON.",

      },

      400

    );

  }



  const motDePasse =

    typeof corps.motDePasse ===

    "string"

      ? corps.motDePasse

      : "";



  const credentialGoogle =

    typeof corps

      .credentialGoogle ===

    "string"

      ? corps.credentialGoogle

      : "";



  const confirmation =

    typeof corps.confirmation ===

    "string"

      ? corps.confirmation.trim()

      : "";

  if (motDePasse.length > 128 || credentialGoogle.length > 10000) {
    return reponseJson({ ok: false, erreur: "Confirmation d’identité invalide." }, 400);
  }



  if (

    confirmation !==

    "SUPPRIMER"

  ) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "La confirmation SUPPRIMER est requise.",

      },

      400

    );

  }



  const utilisateur =

    await env.db

      .prepare(

        `

        SELECT

          utilisateurs.id,

          utilisateurs.hash_mot_de_passe,

          comptes_google.identifiant_google



        FROM utilisateurs



        LEFT JOIN comptes_google

          ON comptes_google.utilisateur_id =

             utilisateurs.id



        WHERE utilisateurs.id = ?

          AND utilisateurs.date_suppression IS NULL



        LIMIT 1

        `

      )

      .bind(

        session.utilisateur_id

      )

      .first();



  if (!utilisateur) {

    return reponseJson(

      {

        ok: false,

        erreur:

          "Compte introuvable.",

      },

      404,

      {

        "Set-Cookie":

          cookieSessionExpire(),

      }

    );

  }

  try {
    const limiteReauth = await env.RATE_LIMIT_CONNEXION.limit({
      key: await creerCleRateLimit(request, `reauth:${session.utilisateur_id}`),
    });
    if (!limiteReauth.success) return reponseTropDeTentatives();
  } catch (erreur) {
    console.error("Erreur rate limiter suppression compte :", erreur);
    return reponseJson({ ok: false, erreur: "La vérification d’identité est temporairement indisponible." }, 503);
  }



  if (

    utilisateur

      .hash_mot_de_passe

  ) {

    if (!motDePasse) {

      return reponseJson(

        {

          ok: false,

          erreur:

            "Votre mot de passe est requis.",

        },

        400

      );

    }



    const motDePasseValide =

      await verifierMotDePasse(

        motDePasse,

        utilisateur

          .hash_mot_de_passe

      );



    if (

      !motDePasseValide

    ) {

      return reponseJson(

        {

          ok: false,

          erreur:

            "Le mot de passe est incorrect.",

        },

        401

      );

    }

  } else {

    if (

      !credentialGoogle ||

      !utilisateur

        .identifiant_google

    ) {

      return reponseJson(

        {

          ok: false,

          erreur:

            "Pour supprimer ce compte, confirmez votre identité avec Google.",

        },

        400

      );

    }



    let google;



    try {

      google =

        await verifierJetonGoogle(

          credentialGoogle,

          env

        );

    } catch (erreur) {

      console.error(

        "Jeton Google refusé à la suppression :",

        erreur

      );



      return reponseJson(

        {

          ok: false,

          erreur:

            "Connexion Google invalide ou expirée.",

        },

        401

      );

    }



    if (

      google.sub !==

      utilisateur

        .identifiant_google

    ) {

      return reponseJson(

        {

          ok: false,

          erreur:

            "Ce compte Google ne correspond pas au compte CLU connecté.",

        },

        401

      );

    }

  }



  const maintenant =

    Date.now();



  const pseudoAnonyme =

    `supprime-${utilisateur.id}`;



  try {

    await env.db.batch([

      env.db

        .prepare(

          `

          DELETE FROM sessions

          WHERE utilisateur_id = ?

          `

        )

        .bind(

          utilisateur.id

        ),



      env.db

        .prepare(

          `

          DELETE FROM codes_recuperation

          WHERE utilisateur_id = ?

          `

        )

        .bind(

          utilisateur.id

        ),



      env.db

        .prepare(

          `

          DELETE FROM comptes_google

          WHERE utilisateur_id = ?

          `

        )

        .bind(

          utilisateur.id

        ),



      env.db

        .prepare(

          `

          UPDATE utilisateurs



          SET

            pseudo = 'Compte supprimé',

            pseudo_normalise = ?,

            hash_mot_de_passe = NULL,

            type_compte = 'gratuit',

            premium_jusqu_a = NULL,

            date_modification = ?,

            date_suppression = ?



          WHERE id = ?

            AND date_suppression IS NULL

          `

        )

        .bind(

          pseudoAnonyme,

          maintenant,

          maintenant,

          utilisateur.id

        ),

    ]);

  } catch (erreur) {

    console.error(

      "Erreur suppression compte :",

      erreur

    );



    return reponseJson(

      {

        ok: false,

        erreur:

          "Impossible de supprimer le compte.",

      },

      500

    );

  }



  return reponseJson(

    {

      ok: true,

      compteSupprime: true,



      message:

        "Le compte CLU a été supprimé et anonymisé. Vous avez été déconnecté.",

    },

    200,

    {

      "Set-Cookie":

        cookieSessionExpire(),

    }

  );

}



async function accepterConditionsCompte(request, env) {
  const session = await obtenirSession(request, env);
  if (!session) {
    return reponseJson({ ok: false, erreur: "Vous devez être connecté." }, 401, {
      "Set-Cookie": cookieSessionExpire(),
    });
  }

  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }
  if (corps.accepteCgu !== true || corps.confirmeMajeur !== true) {
    return reponseJson({ ok: false, erreur: "Vous devez accepter les conditions d’utilisation et confirmer avoir au moins 18 ans." }, 400);
  }

  try {
    await enregistrerAcceptationsLegales(env, session.utilisateur_id, [
      { type: "CGU", version: VERSION_JURIDIQUE_COMPTE },
      { type: "AGE_18", version: VERSION_JURIDIQUE_COMPTE },
    ]);
    const compte = await obtenirInfosCompte(env, session.utilisateur_id);
    return reponseJson({ ok: true, utilisateur: compte });
  } catch (erreur) {
    console.error("Erreur acceptation conditions compte :", erreur);
    return reponseJson({ ok: false, erreur: "Impossible d’enregistrer l’acceptation des conditions." }, 500);
  }
}

async function changerPseudo(request, env) {
  const session = await obtenirSession(request, env);
  if (!session) {
    return reponseJson({ ok: false, erreur: "Vous devez être connecté." }, 401, {
      "Set-Cookie": cookieSessionExpire(),
    });
  }

  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const pseudo = typeof corps.pseudo === "string" ? corps.pseudo.trim() : "";
  if (pseudo.length < 3 || pseudo.length > 24) {
    return reponseJson({ ok: false, erreur: "Le pseudonyme doit contenir entre 3 et 24 caractères." }, 400);
  }

  const maintenant = Date.now();
  const prochain = prochainChangementPseudo(session.date_changement_pseudo);
  if (prochain && maintenant < prochain) {
    return reponseJson({
      ok: false,
      erreur: "Votre pseudonyme ne peut être modifié qu’une fois tous les 15 jours.",
      prochainChangementPseudoA: prochain,
    }, 409);
  }

  const pseudoNormalise = normaliserPseudo(pseudo);
  if (pseudoNormalise === normaliserPseudo(session.pseudo)) {
    return reponseJson({ ok: false, erreur: "Choisissez un pseudonyme différent du pseudonyme actuel." }, 400);
  }

  const existant = await env.db.prepare(`
    SELECT id FROM utilisateurs
    WHERE pseudo_normalise = ? AND id <> ?
    LIMIT 1
  `).bind(pseudoNormalise, session.utilisateur_id).first();
  if (existant) return reponseJson({ ok: false, erreur: "Ce pseudonyme est déjà utilisé." }, 409);

  try {
    await env.db.prepare(`
      UPDATE utilisateurs
      SET pseudo = ?, pseudo_normalise = ?, date_changement_pseudo = ?, date_modification = ?
      WHERE id = ? AND date_suppression IS NULL
    `).bind(pseudo, pseudoNormalise, maintenant, maintenant, session.utilisateur_id).run();
    const compte = await obtenirInfosCompte(env, session.utilisateur_id);
    return reponseJson({ ok: true, utilisateur: compte });
  } catch (erreur) {
    console.error("Erreur changement pseudo :", erreur);
    const message = String(erreur?.message || erreur || "");
    if (/unique|constraint/i.test(message)) {
      return reponseJson({ ok: false, erreur: "Ce pseudonyme est déjà utilisé." }, 409);
    }
    return reponseJson({ ok: false, erreur: "Impossible de modifier le pseudonyme." }, 500);
  }
}

async function exporterDonneesPersonnelles(request, env) {
  const session = await obtenirSession(request, env);
  if (!session) {
    return reponseJson({ ok: false, erreur: "Vous devez être connecté." }, 401, {
      "Set-Cookie": cookieSessionExpire(),
    });
  }

  const utilisateur = await env.db.prepare(`
    SELECT id, pseudo, type_compte, premium_jusqu_a, date_creation, date_modification,
           date_suppression, date_changement_pseudo
    FROM utilisateurs WHERE id = ? LIMIT 1
  `).bind(session.utilisateur_id).first();

  const google = await env.db.prepare(`
    SELECT identifiant_google, date_creation
    FROM comptes_google WHERE utilisateur_id = ? LIMIT 1
  `).bind(session.utilisateur_id).first();

  const sessions = await env.db.prepare(`
    SELECT date_creation, date_expiration, derniere_utilisation
    FROM sessions WHERE utilisateur_id = ? ORDER BY date_creation DESC
  `).bind(session.utilisateur_id).all();

  const paiements = await env.db.prepare(`
    SELECT stripe_session_id, stripe_paiement_id, montant_centimes, devise,
           premium_debut, premium_fin, date_creation,
           montant_rembourse_centimes, date_dernier_remboursement
    FROM paiements_premium
    WHERE utilisateur_id = ? ORDER BY date_creation DESC
  `).bind(session.utilisateur_id).all();

  const acceptations = await env.db.prepare(`
    SELECT type_document, version_document, date_acceptation
    FROM acceptations_legales
    WHERE utilisateur_id = ? ORDER BY date_acceptation DESC
  `).bind(session.utilisateur_id).all();

  const donnees = {
    exportClu: {
      version: "1.0",
      genereLe: new Date().toISOString(),
    },
    compte: utilisateur ? {
      id: utilisateur.id,
      pseudo: utilisateur.pseudo,
      typeCompteEffectif: estPremiumActif(utilisateur.premium_jusqu_a) ? "premium" : "gratuit",
      premiumJusquA: utilisateur.premium_jusqu_a,
      dateCreation: utilisateur.date_creation,
      dateModification: utilisateur.date_modification,
      dateDernierChangementPseudo: utilisateur.date_changement_pseudo,
    } : null,
    google: google ? {
      lie: true,
      identifiantGoogle: google.identifiant_google,
      dateLiaison: google.date_creation,
    } : { lie: false },
    sessions: sessions?.results || [],
    paiementsPremium: paiements?.results || [],
    acceptationsLegales: acceptations?.results || [],
    note: "Les mots de passe, codes de récupération, jetons de session et numéros complets de carte ne sont jamais inclus dans cet export.",
  };

  return reponseJson(donnees, 200, {
    "Content-Disposition": `attachment; filename="clu-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
    "Cache-Control": "no-store",
  });
}

/* ========================================================================== */
/* CLU Métropole — En ligne V2 : mutations, snapshots et horloge autoritaire */
/* Lobby, permissions, présence, blocages et chat éphémère via Durable Object */
/* ========================================================================== */

function clonerValeurOnline(valeur) {
  if (typeof structuredClone === "function") return structuredClone(valeur);
  return JSON.parse(JSON.stringify(valeur));
}

function decoderSegmentPatchOnline(segment) {
  return String(segment).replace(/~1/g, "/").replace(/~0/g, "~");
}

function segmentsPatchOnline(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.length > 320) throw new Error("Chemin de mutation invalide.");
  const segments = path.slice(1).split("/").map(decoderSegmentPatchOnline);
  if (!segments.length || segments.some(segment => !segment || ["__proto__", "prototype", "constructor"].includes(segment))) {
    throw new Error("Chemin de mutation interdit.");
  }
  return segments;
}

function indexPatchOnline(segment, length, allowEnd) {
  if (segment === "-" && allowEnd) return length;
  if (!/^(0|[1-9]\d*)$/.test(segment)) throw new Error("Indice de mutation invalide.");
  const index = Number(segment);
  const max = allowEnd ? length : length - 1;
  if (!Number.isSafeInteger(index) || index < 0 || index > max) throw new Error("Indice de mutation hors limites.");
  return index;
}

function appliquerPatchesJeuOnline(cible, patches) {
  for (const patch of patches) {
    if (!patch || !["add", "remove", "replace"].includes(patch.op)) throw new Error("Opération de mutation invalide.");
    const segments = segmentsPatchOnline(patch.path);
    let parent = cible;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (Array.isArray(parent)) parent = parent[indexPatchOnline(segment, parent.length, false)];
      else {
        if (!parent || typeof parent !== "object" || !Object.prototype.hasOwnProperty.call(parent, segment)) throw new Error("Chemin de mutation introuvable.");
        parent = parent[segment];
      }
    }
    const feuille = segments[segments.length - 1];
    if (Array.isArray(parent)) {
      const index = indexPatchOnline(feuille, parent.length, patch.op === "add");
      if (patch.op === "add") parent.splice(index, 0, clonerValeurOnline(patch.value));
      else if (patch.op === "remove") parent.splice(index, 1);
      else parent[index] = clonerValeurOnline(patch.value);
    } else {
      if (!parent || typeof parent !== "object") throw new Error("Parent de mutation invalide.");
      if (patch.op === "remove") {
        if (!Object.prototype.hasOwnProperty.call(parent, feuille)) throw new Error("Clé de mutation introuvable.");
        delete parent[feuille];
      } else {
        if (patch.op === "replace" && !Object.prototype.hasOwnProperty.call(parent, feuille)) throw new Error("Clé de mutation introuvable.");
        parent[feuille] = clonerValeurOnline(patch.value);
      }
    }
  }
  return cible;
}

function sauvegardeJeuOnlineValide(save) {
  return Boolean(
    save && typeof save === "object" &&
    typeof save.id === "string" && typeof save.name === "string" &&
    save.mode === "FREE" && Number.isFinite(Number(save.version)) &&
    save.data && typeof save.data === "object" &&
    save.data.network && typeof save.data.network === "object" &&
    save.data.economy && typeof save.data.economy === "object" &&
    save.data.simulation && typeof save.data.simulation === "object" &&
    Number.isFinite(Number(save.data.simulationDay))
  );
}

function valeursOnlineEgales(a, b) {
  if (Object.is(a, b)) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch { return false; }
}

function tableauOnline(valeur) {
  return Array.isArray(valeur) ? valeur : [];
}

function mapOnlineParId(valeur) {
  const resultat = new Map();
  for (const item of tableauOnline(valeur)) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || resultat.has(item.id)) continue;
    resultat.set(item.id, item);
  }
  return resultat;
}

function stationsLigneOnline(line) {
  const resultat = [];
  for (const station of tableauOnline(line?.stations)) resultat.push(station);
  for (const branche of tableauOnline(line?.branches)) {
    for (const station of tableauOnline(branche?.stations)) resultat.push(station);
  }
  return resultat;
}

function projectionOnline(source, cles) {
  const resultat = {};
  for (const cle of cles) resultat[cle] = source?.[cle];
  return resultat;
}

function transactionsNouvellesOnline(avant, apres) {
  const listeAvant = tableauOnline(avant?.data?.economy?.transactions);
  const listeApres = tableauOnline(apres?.data?.economy?.transactions);
  const anciennes = mapOnlineParId(listeAvant);
  const nouvelles = [];
  let dernierIndexAncien = -1;
  let nouvelleRencontree = false;
  for (const transaction of listeApres) {
    if (!transaction || typeof transaction !== "object" || typeof transaction.id !== "string" || !transaction.id) {
      throw new Error("Transaction financière invalide.");
    }
    const precedente = anciennes.get(transaction.id);
    if (!precedente) {
      nouvelleRencontree = true;
      nouvelles.push(transaction);
      continue;
    }
    if (nouvelleRencontree) throw new Error("Les nouvelles transactions doivent être ajoutées en fin d'historique.");
    if (!valeursOnlineEgales(precedente, transaction)) throw new Error("Une transaction financière existante ne peut pas être réécrite.");
    const indexAncien = listeAvant.findIndex(item => item?.id === transaction.id);
    if (indexAncien <= dernierIndexAncien) throw new Error("L'ordre de l'historique financier ne peut pas être réécrit.");
    dernierIndexAncien = indexAncien;
  }
  // Le moteur ne supprime que le préfixe le plus ancien lorsque la limite
  // d'historique est atteinte. Un client ne peut donc pas effacer arbitrairement
  // une transaction passée pour masquer une dépense ou une dette.
  const idsApresExistants = listeApres.filter(item => anciennes.has(item?.id)).map(item => item.id);
  if (idsApresExistants.length) {
    const premier = listeAvant.findIndex(item => item?.id === idsApresExistants[0]);
    const suffixe = listeAvant.slice(premier).map(item => item?.id).filter(Boolean);
    const attendus = suffixe.slice(0, idsApresExistants.length);
    if (!valeursOnlineEgales(idsApresExistants, attendus)) throw new Error("L'historique financier ne peut être tronqué qu'en supprimant ses entrées les plus anciennes.");
  }
  if (listeApres.length < listeAvant.length && nouvelles.length === 0) throw new Error("L'historique financier ne peut pas être réduit sans nouvelle transaction.");
  return nouvelles;
}

function validerNouvelleLigneOnline(ligne) {
  if (!ligne || typeof ligne !== "object") throw new Error("Nouvelle ligne invalide.");
  if (ligne.status !== "PROJECT") throw new Error("Une nouvelle ligne doit commencer comme projet.");
  if (stationsLigneOnline(ligne).length !== 0) throw new Error("Les stations d'une nouvelle ligne doivent être ajoutées séparément.");
  if (tableauOnline(ligne.branches).length !== 0) throw new Error("Une nouvelle ligne ne peut pas contenir de branche avant sa création.");
  if (Number(ligne.vehicleCount ?? 0) !== 0) throw new Error("Une nouvelle ligne ne peut pas recevoir de matériel roulant sans action dédiée.");
  if (ligne.depotId != null && String(ligne.depotId)) throw new Error("Une nouvelle ligne ne peut pas être rattachée à un dépôt sans action dédiée.");
  if (Number(ligne.constructionCost ?? 0) !== 0 || Number(ligne.constructionDaysRemaining ?? 0) !== 0) throw new Error("État de construction initial invalide.");
  const upgrades = ligne.rollingStockUpgrades || {};
  if (["capacity", "speed", "reliability", "efficiency", "boarding"].some(cle => Number(upgrades?.[cle] ?? 0) !== 0)) throw new Error("Une nouvelle ligne ne peut pas contenir d'amélioration de matériel gratuite.");
}

function stationPartageeReferenceOnline(save, ligneId, station) {
  const sharedId = String(station?.sharedStationId || "");
  if (!sharedId) return null;
  for (const ligne of tableauOnline(save?.data?.network?.lines)) {
    for (const candidate of stationsLigneOnline(ligne)) {
      if (ligne?.id === ligneId && candidate?.id === station?.id) continue;
      if (String(candidate?.sharedStationId || candidate?.id || "") === sharedId) return candidate;
    }
  }
  return null;
}

function validerNouvelleStationOnline(saveAvant, ligneId, station) {
  const reference = stationPartageeReferenceOnline(saveAvant, ligneId, station);
  if (reference) {
    if (String(station?.facilityLevel || "BASIC") !== String(reference?.facilityLevel || "BASIC")) throw new Error("Une occurrence de station partagée doit conserver son niveau d'équipement.");
    return;
  }
  if (String(station?.facilityLevel || "BASIC") !== "BASIC") throw new Error("Une nouvelle station doit commencer au niveau Simple.");
}

function validerStructureSauvegardeOnline(save) {
  if (!sauvegardeJeuOnlineValide(save)) throw new Error("Sauvegarde Online invalide.");
  const lignes = tableauOnline(save?.data?.network?.lines);
  if (lignes.length > 1000) throw new Error("Nombre de lignes trop élevé.");
  const idsLignes = new Set();
  let totalStations = 0;
  for (const ligne of lignes) {
    if (!ligne || typeof ligne !== "object" || typeof ligne.id !== "string" || !ligne.id || idsLignes.has(ligne.id)) throw new Error("Identifiant de ligne invalide ou dupliqué.");
    idsLignes.add(ligne.id);
    const stations = stationsLigneOnline(ligne);
    totalStations += stations.length;
    if (stations.length > 5000) throw new Error("Nombre de stations d'une ligne trop élevé.");
    const idsStations = new Set();
    for (const station of stations) {
      if (!station || typeof station !== "object" || typeof station.id !== "string" || !station.id || idsStations.has(station.id)) throw new Error("Identifiant de station invalide ou dupliqué.");
      idsStations.add(station.id);
      const longitude = Number(station.longitude);
      const latitude = Number(station.latitude);
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Coordonnées de station invalides.");
    }
    const vehicules = Number(ligne.vehicleCount ?? 0);
    if (!Number.isFinite(vehicules) || vehicules < 0 || vehicules > 100000) throw new Error("Taille de flotte invalide.");
  }
  if (totalStations > 20000) throw new Error("Nombre total de stations trop élevé.");
  const economy = save.data.economy;
  for (const cle of ["initialBudget", "balance", "totalSpent", "totalInvestment", "totalRevenue", "totalOperatingCosts", "debtPrincipal"]) {
    const valeur = Number(economy?.[cle] ?? 0);
    if (!Number.isFinite(valeur) || Math.abs(valeur) > 1e15) throw new Error(`Valeur financière invalide : ${cle}.`);
  }
  if (Number(economy?.debtPrincipal ?? 0) < 0 || Number(economy?.totalSpent ?? 0) < 0 || Number(economy?.totalInvestment ?? 0) < 0) throw new Error("Totaux financiers invalides.");
  const transactions = tableauOnline(economy?.transactions);
  if (transactions.length > 5000) throw new Error("Historique financier trop volumineux.");
  const idsTransactions = new Set();
  for (const transaction of transactions) {
    if (!transaction || typeof transaction !== "object" || typeof transaction.id !== "string" || !transaction.id || idsTransactions.has(transaction.id)) throw new Error("Identifiant de transaction financière invalide ou dupliqué.");
    idsTransactions.add(transaction.id);
    const montant = Number(transaction.amount);
    if (!Number.isFinite(montant) || Math.abs(montant) > 1e15) throw new Error("Montant de transaction financière invalide.");
    if (typeof transaction.kind !== "string" || !transaction.kind) throw new Error("Type de transaction financière invalide.");
  }
}

const CLU_ONLINE_CHAMPS_LIGNE_MATERIEL = Object.freeze([
  "rollingStockModelId", "vehicleCount", "fleetCondition", "rollingStockUpgrades", "maintenanceLevel",
]);
const CLU_ONLINE_CHAMPS_LIGNE_FREQUENCE = Object.freeze(["serviceLevel", "serviceProfileMode", "serviceProfile"]);
const CLU_ONLINE_CHAMPS_LIGNE_EXPLOITATION = Object.freeze(["inspectionMode", "controllerCount"]);
const CLU_ONLINE_CHAMPS_LIGNE_STRUCTURE = Object.freeze([
  "name", "customLogoDataUrl", "shortCode", "badgeStyle", "emblem", "mode", "infrastructureType",
  "routingMode", "routeSegments", "infrastructureSegments", "color",
]);
const CLU_ONLINE_CHAMPS_DETTE = Object.freeze([
  "debtPrincipal", "lastBorrowDay", "borrowCountOnLastDay", "totalInterestPaid", "debtNextPaymentDay",
  "debtMinimumPayment", "debtPaidThisPeriod", "debtMissedPayments", "totalDebtPenalties", "creditScore", "insolvencyStatus",
]);
const CLU_ONLINE_CHAMPS_BUDGET = Object.freeze(["unlimitedMoney", "initialBudget"]);
const CLU_ONLINE_CHAMPS_FINANCE_DERIVES = Object.freeze([
  "balance", "totalSpent", "totalInvestment", "totalRevenue", "totalPassengerRevenue", "totalFineRevenue",
  "totalOperatingCosts", "totalSubsidies", "totalPublicDevelopmentFunding", "totalObjectiveRewards", "publicFundingNextDay",
  "lastPublicFundingDay", "lastPublicFundingAmount", "lastPublicFundingBreakdown", "totalCompensationPaid",
]);

function ajouterPermissionAnalyseOnline(analyse, permission) {
  analyse.requises.add(permission);
  analyse.primaires.add(permission);
}

function analyserTransactionsOnline(analyse, avant, apres) {
  const nouvelles = transactionsNouvellesOnline(avant, apres);
  analyse.transactionsNouvelles = nouvelles;
  for (const transaction of nouvelles) {
    const kind = String(transaction.kind || "");
    switch (kind) {
      case "LINE_PROJECT": ajouterPermissionAnalyseOnline(analyse, "construire_lignes"); analyse.requises.add("effectuer_depenses"); break;
      case "LINE_MODIFICATION":
      case "SEGMENT_CONSTRUCTION": ajouterPermissionAnalyseOnline(analyse, "modifier_lignes"); analyse.requises.add("effectuer_depenses"); break;
      case "STATION_CONSTRUCTION": ajouterPermissionAnalyseOnline(analyse, "construire_stations"); analyse.requises.add("effectuer_depenses"); break;
      case "STATION_UPGRADE": ajouterPermissionAnalyseOnline(analyse, "modifier_stations"); analyse.requises.add("effectuer_depenses"); break;
      case "VEHICLE_PURCHASE":
      case "FLEET_OVERHAUL":
      case "FLEET_UPGRADE": ajouterPermissionAnalyseOnline(analyse, "gerer_materiel_roulant"); analyse.requises.add("effectuer_depenses"); break;
      case "VEHICLE_SALE": ajouterPermissionAnalyseOnline(analyse, "gerer_materiel_roulant"); break;
      case "DEPOT_CONSTRUCTION":
      case "DEPOT_UPGRADE": ajouterPermissionAnalyseOnline(analyse, "gerer_depots"); analyse.requises.add("effectuer_depenses"); break;
      case "INFRASTRUCTURE_UPGRADE": ajouterPermissionAnalyseOnline(analyse, "modifier_lignes"); analyse.requises.add("effectuer_depenses"); break;
      case "TEMPORARY_SERVICE":
      case "SERVICE_REINFORCEMENT": ajouterPermissionAnalyseOnline(analyse, "gerer_exploitation"); analyse.requises.add("effectuer_depenses"); break;
      case "SERVICE_SUBSTITUTION": ajouterPermissionAnalyseOnline(analyse, "gerer_incidents"); analyse.requises.add("effectuer_depenses"); break;
      case "DEBT_BORROW":
      case "DEBT_REPAYMENT": ajouterPermissionAnalyseOnline(analyse, "gerer_emprunts"); break;
      case "OBJECTIVE_REWARD":
      case "MUNICIPALITY_SUBSIDY":
      case "PUBLIC_DEVELOPMENT_GRANT":
      case "PASSENGER_COMPENSATION":
      case "DEBT_INTEREST":
      case "DEBT_PENALTY": analyse.reserveAdmin = true; break;
      default: throw new Error(`Type de transaction financière non autorisé : ${kind || "inconnu"}.`);
    }
  }
}

function analyserReseauOnline(analyse, avant, apres) {
  const avantNetwork = avant?.data?.network || {};
  const apresNetwork = apres?.data?.network || {};
  const avantLignes = mapOnlineParId(avantNetwork.lines);
  const apresLignes = mapOnlineParId(apresNetwork.lines);
  const lignesSupprimees = new Set();

  for (const [id, ligne] of apresLignes.entries()) {
    if (avantLignes.has(id)) continue;
    validerNouvelleLigneOnline(ligne);
    ajouterPermissionAnalyseOnline(analyse, "construire_lignes");
  }
  for (const id of avantLignes.keys()) if (!apresLignes.has(id)) { ajouterPermissionAnalyseOnline(analyse, "supprimer_lignes"); lignesSupprimees.add(id); }

  for (const [id, avantLigne] of avantLignes.entries()) {
    const apresLigne = apresLignes.get(id);
    if (!apresLigne) continue;
    const avantStations = mapOnlineParId(stationsLigneOnline(avantLigne));
    const apresStations = mapOnlineParId(stationsLigneOnline(apresLigne));
    for (const [stationId, station] of apresStations.entries()) {
      if (avantStations.has(stationId)) continue;
      validerNouvelleStationOnline(avant, id, station);
      ajouterPermissionAnalyseOnline(analyse, "construire_stations");
    }
    for (const stationId of avantStations.keys()) if (!apresStations.has(stationId)) ajouterPermissionAnalyseOnline(analyse, "supprimer_stations");
    for (const [stationId, avantStation] of avantStations.entries()) {
      const apresStation = apresStations.get(stationId);
      if (!apresStation || valeursOnlineEgales(avantStation, apresStation)) continue;
      if (!valeursOnlineEgales(avantStation.facilityLevel ?? "BASIC", apresStation.facilityLevel ?? "BASIC")) {
        // Le niveau d'équipement n'est jamais modifié directement par le joueur :
        // l'action STATION_UPGRADE crée d'abord un chantier, puis l'admin de
        // simulation applique le niveau à son terme.
        analyse.reserveAdmin = true;
      }
      const avantEditable = { ...avantStation }; delete avantEditable.facilityLevel;
      const apresEditable = { ...apresStation }; delete apresEditable.facilityLevel;
      if (!valeursOnlineEgales(avantEditable, apresEditable)) ajouterPermissionAnalyseOnline(analyse, "modifier_stations");
    }

    if (!valeursOnlineEgales(avantLigne.createdAt, apresLigne.createdAt)) throw new Error("La date de création d'une ligne est immuable.");
    const transactionsLigne = analyse.transactionsNouvelles.filter(item => item?.lineId === id);
    const kindsLigne = new Set(transactionsLigne.map(item => String(item?.kind || "")));
    if (!valeursOnlineEgales(avantLigne.status, apresLigne.status)) {
      if (!(avantLigne.status === "PROJECT" && apresLigne.status === "OPERATIONAL" && kindsLigne.has("LINE_PROJECT"))) analyse.reserveAdmin = true;
    }
    if (!valeursOnlineEgales(avantLigne.constructionDaysRemaining, apresLigne.constructionDaysRemaining)) {
      if (!kindsLigne.has("LINE_PROJECT")) analyse.reserveAdmin = true;
    }
    if (!valeursOnlineEgales(avantLigne.constructionCost, apresLigne.constructionCost)) {
      const autorisee = ["LINE_PROJECT", "LINE_MODIFICATION", "SEGMENT_CONSTRUCTION", "STATION_CONSTRUCTION"].some(kind => kindsLigne.has(kind));
      if (!autorisee) analyse.reserveAdmin = true;
    }
    if (!valeursOnlineEgales(avantLigne.estimatedConstructionCost, apresLigne.estimatedConstructionCost)
        && analyse.primaires.size === 0) analyse.reserveAdmin = true;

    if (!valeursOnlineEgales(projectionOnline(avantLigne, CLU_ONLINE_CHAMPS_LIGNE_MATERIEL), projectionOnline(apresLigne, CLU_ONLINE_CHAMPS_LIGNE_MATERIEL))) ajouterPermissionAnalyseOnline(analyse, "gerer_materiel_roulant");
    if (!valeursOnlineEgales(avantLigne.depotId, apresLigne.depotId)) ajouterPermissionAnalyseOnline(analyse, "gerer_depots");
    if (!valeursOnlineEgales(avantLigne.schedule, apresLigne.schedule)) ajouterPermissionAnalyseOnline(analyse, "gerer_horaires");
    if (!valeursOnlineEgales(projectionOnline(avantLigne, CLU_ONLINE_CHAMPS_LIGNE_FREQUENCE), projectionOnline(apresLigne, CLU_ONLINE_CHAMPS_LIGNE_FREQUENCE))) ajouterPermissionAnalyseOnline(analyse, "gerer_frequences");
    if (!valeursOnlineEgales(projectionOnline(avantLigne, CLU_ONLINE_CHAMPS_LIGNE_EXPLOITATION), projectionOnline(apresLigne, CLU_ONLINE_CHAMPS_LIGNE_EXPLOITATION))) ajouterPermissionAnalyseOnline(analyse, "gerer_exploitation");
    if (!valeursOnlineEgales(avantLigne.regulationMode, apresLigne.regulationMode) || !valeursOnlineEgales(avantLigne.manualBoostVehicles, apresLigne.manualBoostVehicles)) ajouterPermissionAnalyseOnline(analyse, "gerer_pcc");
    if (!valeursOnlineEgales(projectionOnline(avantLigne, CLU_ONLINE_CHAMPS_LIGNE_STRUCTURE), projectionOnline(apresLigne, CLU_ONLINE_CHAMPS_LIGNE_STRUCTURE))) ajouterPermissionAnalyseOnline(analyse, "modifier_lignes");
    const avantBranches = tableauOnline(avantLigne.branches).map(branche => ({ id: branche?.id, fromStationId: branche?.fromStationId }));
    const apresBranches = tableauOnline(apresLigne.branches).map(branche => ({ id: branche?.id, fromStationId: branche?.fromStationId }));
    if (!valeursOnlineEgales(avantBranches, apresBranches)) ajouterPermissionAnalyseOnline(analyse, "modifier_lignes");
  }

  if (!valeursOnlineEgales(avantNetwork.depots || [], apresNetwork.depots || [])) ajouterPermissionAnalyseOnline(analyse, "gerer_depots");
  if (!valeursOnlineEgales(avantNetwork.walkingTransfers || [], apresNetwork.walkingTransfers || [])
      && !analyse.primaires.has("construire_stations") && !analyse.primaires.has("modifier_stations")
      && !analyse.primaires.has("supprimer_stations") && !analyse.primaires.has("supprimer_lignes")) {
    ajouterPermissionAnalyseOnline(analyse, "modifier_stations");
  }
  analyse.lignesSupprimees = lignesSupprimees;
}

function analyserOperationsOnline(analyse, avant, apres) {
  const a = avant?.data?.operations || {};
  const b = apres?.data?.operations || {};
  const suppressionLigne = analyse.primaires.has("supprimer_lignes");
  if (!valeursOnlineEgales(a.pccControlLevels || {}, b.pccControlLevels || {})) ajouterPermissionAnalyseOnline(analyse, "gerer_pcc");
  if (!valeursOnlineEgales(a.tripOverrides || [], b.tripOverrides || []) || !valeursOnlineEgales(a.extraTrips || [], b.extraTrips || [])) {
    if (!suppressionLigne) ajouterPermissionAnalyseOnline(analyse, "gerer_exploitation");
  }
  const stationUpgrade = analyse.transactionsNouvelles.some(item => item?.kind === "STATION_UPGRADE");
  if (!valeursOnlineEgales(a.disruptions || [], b.disruptions || []) || !valeursOnlineEgales(a.substitutionServices || [], b.substitutionServices || [])) {
    if (!suppressionLigne) ajouterPermissionAnalyseOnline(analyse, "gerer_incidents");
  }
  if (!valeursOnlineEgales(a.stationWorks || [], b.stationWorks || []) && !suppressionLigne && !stationUpgrade) ajouterPermissionAnalyseOnline(analyse, "gerer_incidents");

  // Ces champs sont des journaux / marqueurs dérivés. Ils peuvent accompagner
  // une vraie action d'exploitation mais ne constituent jamais une action
  // autonome envoyable par un client.
  const operationPrimaire = suppressionLigne
    || analyse.primaires.has("gerer_pcc")
    || analyse.primaires.has("gerer_exploitation")
    || analyse.primaires.has("gerer_incidents")
    || stationUpgrade;
  if (!valeursOnlineEgales(a.history || [], b.history || []) && !operationPrimaire) analyse.reserveAdmin = true;
  if (!valeursOnlineEgales(a.autoHandledDisruptionIds || [], b.autoHandledDisruptionIds || [])) analyse.reserveAdmin = true;
}

function analyserEvenementsOnline(analyse, avant, apres) {
  const a = avant?.data?.events || {};
  const b = apres?.data?.events || {};
  if (valeursOnlineEgales(a, b)) return;

  const actif = a.active;
  const jour = Number(avant?.data?.simulationDay) || 1;
  const historiqueAvant = tableauOnline(a.history);
  const historiqueApres = tableauOnline(b.history);
  const modificateursAvant = tableauOnline(a.modifiers);
  const modificateursApres = tableauOnline(b.modifiers);

  // Une décision joueur est la seule mutation d'événement acceptée hors
  // simulation : l'événement actif disparaît et UNE entrée RESOLVED est ajoutée.
  // La création/expiration d'événements reste exclusivement pilotée par le
  // passage de jour autoritaire de l'administrateur.
  if (!actif || b.active !== null || historiqueApres.length < 1) {
    analyse.reserveAdmin = true;
    return;
  }

  const entree = historiqueApres.at(-1);
  const choix = tableauOnline(actif.choices).find(item => item?.id === entree?.choiceId);
  if (!entree || !choix || entree.id !== actif.id || entree.status !== "RESOLVED" || Number(entree.resolvedDay) !== jour) {
    analyse.reserveAdmin = true;
    return;
  }

  const historiqueConserve = historiqueApres.slice(0, -1);
  const suffixeAvant = historiqueAvant.slice(Math.max(0, historiqueAvant.length - historiqueConserve.length));
  if (!valeursOnlineEgales(historiqueConserve, suffixeAvant)) throw new Error("L'historique des événements ne peut pas être réécrit.");

  let impactSolde = 0;
  let impactSubventions = 0;
  const attendus = [];
  for (const effet of tableauOnline(choix.effects)) {
    if (effet?.kind === "BALANCE") {
      const montant = Math.round(Number(effet.amount) || 0);
      const effectif = avant?.data?.economy?.unlimitedMoney === true && montant < 0 ? 0 : montant;
      impactSolde += effectif;
      if (effectif > 0) impactSubventions += effectif;
      continue;
    }
    if (!["DEMAND_MULTIPLIER", "REVENUE_MULTIPLIER", "OPERATING_COST_MULTIPLIER"].includes(String(effet?.kind || ""))) {
      throw new Error("Effet d'événement invalide.");
    }
    const duree = Math.max(1, Math.floor(Number(effet.durationDays) || 0));
    attendus.push({
      sourceEventId: actif.id,
      sourceTitle: actif.title,
      kind: effet.kind,
      multiplier: Math.max(0, Number(effet.multiplier) || 0),
      label: effet.label,
      startsDay: jour + 1,
      endsDay: jour + duree,
    });
  }

  if (Number(entree.balanceImpact) !== impactSolde) throw new Error("Impact financier d'événement invalide.");
  if (Number(b.totalResolved) !== Number(a.totalResolved || 0) + 1) throw new Error("Compteur d'événements résolus invalide.");
  if (Number(b.totalBalanceImpact) !== Number(a.totalBalanceImpact || 0) + impactSolde) throw new Error("Cumul financier d'événements invalide.");
  const prochainJour = Number(b.nextEligibleDay);
  if (!Number.isInteger(prochainJour) || prochainJour <= jour || prochainJour > jour + 3650) throw new Error("Prochaine date d'événement invalide.");

  if (modificateursApres.length !== modificateursAvant.length + attendus.length) throw new Error("Modificateurs d'événement invalides.");
  if (!valeursOnlineEgales(modificateursApres.slice(0, modificateursAvant.length), modificateursAvant)) throw new Error("Les modificateurs d'événement existants sont immuables.");
  for (let index = 0; index < attendus.length; index++) {
    const recu = modificateursApres[modificateursAvant.length + index] || {};
    const { id: _id, ...sansId } = recu;
    if (!valeursOnlineEgales(sansId, attendus[index])) throw new Error("Modificateur d'événement invalide.");
  }

  analyse.eventDecision = true;
  analyse.eventBalanceImpact = impactSolde;
  analyse.eventSubsidyImpact = impactSubventions;
  ajouterPermissionAnalyseOnline(analyse, "gerer_evenements");
  if (impactSolde < 0) analyse.requises.add("effectuer_depenses");
}

function analyserEconomieOnline(analyse, avant, apres) {
  const a = avant?.data?.economy || {};
  const b = apres?.data?.economy || {};
  const politiqueAvant = clonerValeurOnline(a.customFarePolicy || {});
  const politiqueApres = b.customFarePolicy || {};
  for (const lineId of analyse.lignesSupprimees || []) {
    if (politiqueAvant?.lineTicketPrices && typeof politiqueAvant.lineTicketPrices === "object") delete politiqueAvant.lineTicketPrices[lineId];
  }
  if (!valeursOnlineEgales(a.fareLevel, b.fareLevel) || !valeursOnlineEgales(a.fareManagementMode, b.fareManagementMode) || !valeursOnlineEgales(politiqueAvant, politiqueApres)) ajouterPermissionAnalyseOnline(analyse, "gerer_tarification");
  if (!valeursOnlineEgales(projectionOnline(a, CLU_ONLINE_CHAMPS_DETTE), projectionOnline(b, CLU_ONLINE_CHAMPS_DETTE))) ajouterPermissionAnalyseOnline(analyse, "gerer_emprunts");
  if (!valeursOnlineEgales(projectionOnline(a, CLU_ONLINE_CHAMPS_BUDGET), projectionOnline(b, CLU_ONLINE_CHAMPS_BUDGET))) ajouterPermissionAnalyseOnline(analyse, "gerer_budget");

  const financeDeriveeChange = !valeursOnlineEgales(projectionOnline(a, CLU_ONLINE_CHAMPS_FINANCE_DERIVES), projectionOnline(b, CLU_ONLINE_CHAMPS_FINANCE_DERIVES));
  const nombre = valeur => Number.isFinite(Number(valeur)) ? Number(valeur) : 0;
  const financeEvenementValide = analyse.eventDecision === true
    && Math.abs((nombre(b.balance) - nombre(a.balance)) - nombre(analyse.eventBalanceImpact)) <= 0.01
    && Math.abs((nombre(b.totalSubsidies) - nombre(a.totalSubsidies)) - nombre(analyse.eventSubsidyImpact)) <= 0.01
    && CLU_ONLINE_CHAMPS_FINANCE_DERIVES
      .filter(cle => !["balance", "totalSubsidies"].includes(cle))
      .every(cle => Math.abs(nombre(b[cle]) - nombre(a[cle])) <= 0.01);
  if (financeDeriveeChange && analyse.transactionsNouvelles.length === 0 && !financeEvenementValide) ajouterPermissionAnalyseOnline(analyse, "gerer_finances");
}

function analyserMunicipalitesOnline(analyse, avant, apres) {
  const a = avant?.data?.municipalities || {};
  const b = apres?.data?.municipalities || {};
  const requetesChangees = !valeursOnlineEgales(a.requests || [], b.requests || []);
  const relationsChangees = !valeursOnlineEgales(a.relations || [], b.relations || []);
  if (requetesChangees) ajouterPermissionAnalyseOnline(analyse, "gerer_urbanisme");
  if (relationsChangees) {
    // Accepter, refuser ou négocier une demande modifie aussi la relation avec
    // la commune. Une variation de relation isolée vient en revanche du moteur
    // de simulation et reste autoritaire côté admin.
    if (requetesChangees) analyse.requises.add("gerer_urbanisme");
    else analyse.reserveAdmin = true;
  }
  if (!valeursOnlineEgales(a.totalSubsidiesReceived ?? 0, b.totalSubsidiesReceived ?? 0)) analyse.reserveAdmin = true;
  if (!valeursOnlineEgales(a.urbanProjects || [], b.urbanProjects || [])) analyse.reserveAdmin = true;
  if (!valeursOnlineEgales(a.development || [], b.development || []) || !valeursOnlineEgales(a.nextUrbanProjectDay, b.nextUrbanProjectDay) || !valeursOnlineEgales(a.nextLocalEventDay, b.nextLocalEventDay)) analyse.reserveAdmin = true;
  if (!valeursOnlineEgales(a.localEvents || [], b.localEvents || [])) {
    const serviceTemporaire = analyse.transactionsNouvelles.some(item => item?.kind === "TEMPORARY_SERVICE" || item?.kind === "SERVICE_REINFORCEMENT");
    if (serviceTemporaire) ajouterPermissionAnalyseOnline(analyse, "gerer_exploitation");
    else analyse.reserveAdmin = true;
  }
}

function validerPassagersDerivesOnline(analyse, avant, apres) {
  const a = avant?.data?.passengers || {};
  const b = apres?.data?.passengers || {};
  if (valeursOnlineEgales(a, b)) return;
  const reseauPrimaire = ["construire_lignes", "modifier_lignes", "supprimer_lignes", "construire_stations", "modifier_stations", "supprimer_stations"]
    .some(permission => analyse.primaires.has(permission));
  if (!reseauPrimaire) { analyse.reserveAdmin = true; return; }

  const resteA = { ...a }; const resteB = { ...b };
  delete resteA.waitingCohorts; delete resteB.waitingCohorts;
  delete resteA.lastReport; delete resteB.lastReport;
  if (!valeursOnlineEgales(resteA, resteB)) throw new Error("Les compteurs voyageurs sont réservés à la simulation.");
  if (!valeursOnlineEgales(a.lastReport ?? null, b.lastReport ?? null) && b.lastReport !== null) throw new Error("Un rapport voyageurs ne peut être fabriqué par une action joueur.");

  const avantCohortes = mapOnlineParId(a.waitingCohorts);
  for (const cohorte of tableauOnline(b.waitingCohorts)) {
    const precedente = avantCohortes.get(cohorte?.id);
    if (!precedente || !valeursOnlineEgales(precedente, cohorte)) throw new Error("Les files voyageurs ne peuvent être modifiées que par nettoyage de références supprimées.");
  }
}

function validerObjectifsDerivesOnline(analyse, avant, apres) {
  const a = avant?.data?.objectives || {};
  const b = apres?.data?.objectives || {};
  if (valeursOnlineEgales(a, b)) return;
  if (!analyse.primaires.has("supprimer_lignes")) { analyse.reserveAdmin = true; return; }

  const resteA = { ...a }; const resteB = { ...b };
  delete resteA.active; delete resteB.active;
  if (!valeursOnlineEgales(resteA, resteB)) throw new Error("La progression des objectifs est réservée à la simulation.");
  const actifsAvant = mapOnlineParId(a.active);
  for (const objectif of tableauOnline(b.active)) {
    const precedent = actifsAvant.get(objectif?.id);
    if (!precedent || !valeursOnlineEgales(precedent, objectif)) throw new Error("Un objectif actif ne peut pas être fabriqué pendant une suppression de ligne.");
  }
  const idsApres = new Set(tableauOnline(b.active).map(item => item?.id));
  for (const objectif of tableauOnline(a.active)) {
    if (idsApres.has(objectif?.id)) continue;
    if (!analyse.lignesSupprimees.has(String(objectif?.lineId || ""))) throw new Error("Seuls les objectifs rattachés à une ligne supprimée peuvent être nettoyés.");
  }
}

function validerSimulationDeriveeOnline(analyse, avant, apres) {
  const a = avant?.data?.simulation || {};
  const b = apres?.data?.simulation || {};
  if (valeursOnlineEgales(a, b)) return;
  if (!analyse.primaires.has("supprimer_lignes")) { analyse.reserveAdmin = true; return; }
  const resteA = { ...a }; const resteB = { ...b };
  delete resteA.lineStates; delete resteB.lineStates;
  if (!valeursOnlineEgales(resteA, resteB)) { analyse.reserveAdmin = true; return; }
  const attendus = tableauOnline(a.lineStates).filter(item => !analyse.lignesSupprimees.has(String(item?.lineId || "")));
  if (!valeursOnlineEgales(attendus, tableauOnline(b.lineStates))) throw new Error("Le nettoyage de simulation ne correspond pas aux lignes supprimées.");
}

function validerStatistiquesActionOnline(analyse, avant, apres) {
  const a = avant?.data?.statistics || {};
  const b = apres?.data?.statistics || {};
  if (valeursOnlineEgales(a, b)) return;
  if (analyse.primaires.size === 0) { analyse.reserveAdmin = true; return; }

  for (const cle of ["trackingStartedDay", "migratedFromOlderSave", "baselineEconomyTotals", "weeks", "records"]) {
    if (!valeursOnlineEgales(a[cle], b[cle])) throw new Error(`La statistique ${cle} est réservée à la simulation.`);
  }

  const lignesAvant = mapOnlineParId(avant?.data?.network?.lines);
  const lignesApres = mapOnlineParId(apres?.data?.network?.lines);
  const transactions = analyse.transactionsNouvelles || [];
  const lancements = transactions.filter(item => item?.kind === "LINE_PROJECT");
  let lignesSupprimees = 0;
  let stationsConstruites = 0;
  let stationsSupprimees = 0;

  for (const transaction of lancements) {
    const ligne = lignesApres.get(transaction?.lineId);
    if (!ligne) throw new Error("Statistique de mise en service sans ligne correspondante.");
    stationsConstruites += stationsLigneOnline(ligne).length;
  }
  for (const [id, ligneAvant] of lignesAvant.entries()) {
    const ligneApres = lignesApres.get(id);
    if (!ligneApres) {
      if (ligneAvant?.status !== "PROJECT") {
        lignesSupprimees += 1;
        stationsSupprimees += stationsLigneOnline(ligneAvant).length;
      }
      continue;
    }
    if (ligneAvant?.status === "PROJECT") continue;
    const idsAvant = new Set(stationsLigneOnline(ligneAvant).map(item => item?.id));
    const idsApres = new Set(stationsLigneOnline(ligneApres).map(item => item?.id));
    for (const idStation of idsApres) if (!idsAvant.has(idStation)) stationsConstruites += 1;
    for (const idStation of idsAvant) if (!idsApres.has(idStation)) stationsSupprimees += 1;
  }

  const vehiculesAchetes = transactions
    .filter(item => item?.kind === "VEHICLE_PURCHASE")
    .reduce((total, item) => total + Math.max(0, Math.floor(Number(item?.vehicleCount) || 0)), 0);
  const vehiculesVendus = transactions
    .filter(item => item?.kind === "VEHICLE_SALE")
    .reduce((total, item) => total + Math.max(0, Math.floor(Number(item?.vehicleCount) || 0)), 0);
  const nombre = valeur => Number.isFinite(Number(valeur)) ? Number(valeur) : 0;
  const attendus = {
    linesLaunched: lancements.length,
    linesDeleted: lignesSupprimees,
    stationsBuilt: stationsConstruites,
    stationsRemoved: stationsSupprimees,
    vehiclesPurchased: vehiculesAchetes,
    vehiclesSold: vehiculesVendus,
  };
  for (const [cle, delta] of Object.entries(attendus)) {
    if (nombre(b[cle]) - nombre(a[cle]) !== delta) throw new Error(`Compteur statistique incohérent : ${cle}.`);
  }

  const jalonsAvant = tableauOnline(a.milestones);
  const jalonsApres = tableauOnline(b.milestones);
  const attendusKinds = [
    ...Array(lancements.length).fill("LINE_LAUNCHED"),
    ...Array(lignesSupprimees).fill("LINE_DELETED"),
  ];
  const nouveauxCount = attendusKinds.length;
  const conserves = nouveauxCount > 0 ? jalonsApres.slice(0, Math.max(0, jalonsApres.length - nouveauxCount)) : jalonsApres;
  const suffixeAvant = jalonsAvant.slice(Math.max(0, jalonsAvant.length - conserves.length));
  if (!valeursOnlineEgales(conserves, suffixeAvant)) throw new Error("L'historique statistique existant ne peut pas être réécrit.");
  const nouveaux = nouveauxCount > 0 ? jalonsApres.slice(-nouveauxCount) : [];
  const kindsRecus = nouveaux.map(item => item?.kind).sort();
  if (!valeursOnlineEgales(kindsRecus, attendusKinds.sort())) throw new Error("Les jalons statistiques ne correspondent pas à l'action.");
}

function analyserMutationOnline(patches, avant, apres) {
  const analyse = {
    requises: new Set(), primaires: new Set(), reserveAdmin: false,
    transactionsNouvelles: [], lignesSupprimees: new Set(),
    eventDecision: false, eventBalanceImpact: 0, eventSubsidyImpact: 0,
  };
  for (const patch of patches) {
    const segments = segmentsPatchOnline(patch.path);
    if (segments[0] === "name") { ajouterPermissionAnalyseOnline(analyse, "modifier_parametres_jeu"); continue; }
    if (segments[0] !== "data") throw new Error("Cette donnée n'est pas modifiable en ligne.");
    const racine = segments[1];
    if (["uiState", "assistant", "challenge", "generatedTerritory", "calendarStartDate"].includes(racine)) throw new Error("Cette donnée reste locale ou immuable en ligne.");
    if (!["network", "economy", "simulation", "operations", "passengers", "municipalities", "events", "objectives", "statistics", "freePlaySettings", "simulationDay"].includes(racine)) throw new Error("Cette zone de sauvegarde n'est pas modifiable en ligne.");
    if (segments.length < 3 && racine !== "simulationDay") throw new Error("Mutation trop large : ciblez une propriété précise.");
  }

  analyserTransactionsOnline(analyse, avant, apres);
  analyserReseauOnline(analyse, avant, apres);
  analyserOperationsOnline(analyse, avant, apres);
  analyserEvenementsOnline(analyse, avant, apres);
  analyserEconomieOnline(analyse, avant, apres);
  analyserMunicipalitesOnline(analyse, avant, apres);
  validerPassagersDerivesOnline(analyse, avant, apres);
  validerObjectifsDerivesOnline(analyse, avant, apres);
  validerSimulationDeriveeOnline(analyse, avant, apres);
  validerStatistiquesActionOnline(analyse, avant, apres);

  if (!valeursOnlineEgales(avant?.data?.freePlaySettings, apres?.data?.freePlaySettings)) ajouterPermissionAnalyseOnline(analyse, "modifier_parametres_jeu");
  if (!valeursOnlineEgales(avant?.data?.simulationDay, apres?.data?.simulationDay)) analyse.reserveAdmin = true;
  if (!valeursOnlineEgales(avant?.data?.events, apres?.data?.events) && !analyse.eventDecision) analyse.reserveAdmin = true;
  return analyse;
}

function validerPermissionsMutationOnline(membre, patches, avant, apres) {
  validerStructureSauvegardeOnline(apres);
  const analyse = analyserMutationOnline(patches, avant, apres);
  if (membre.role === "administrateur") return analyse;
  if (analyse.reserveAdmin) throw new Error("Cette modification dépend de la simulation autoritaire de l'administrateur.");
  const permissions = membre.permissions || {};
  for (const permission of analyse.requises) {
    if (permissions[permission] !== true) throw new Error(`Permission serveur requise : ${permission}.`);
  }

  const ancien = avant?.data?.economy || {};
  const nouveau = apres?.data?.economy || {};
  const nombre = valeur => Number.isFinite(Number(valeur)) ? Number(valeur) : 0;
  if (nombre(nouveau.totalSpent) + 0.01 < nombre(ancien.totalSpent)) throw new Error("Le total des dépenses ne peut pas être réduit.");
  if (nombre(nouveau.totalInvestment) + 0.01 < nombre(ancien.totalInvestment)) throw new Error("Le total des investissements ne peut pas être réduit.");

  const deltaTresorerie = nombre(nouveau.balance) - nombre(ancien.balance);
  const kindsInvestissement = new Set([
    "STATION_CONSTRUCTION", "SEGMENT_CONSTRUCTION", "LINE_PROJECT", "LINE_MODIFICATION",
    "VEHICLE_PURCHASE", "FLEET_OVERHAUL", "FLEET_UPGRADE", "DEPOT_CONSTRUCTION", "DEPOT_UPGRADE",
    "INFRASTRUCTURE_UPGRADE", "STATION_UPGRADE",
  ]);
  const kindsExploitation = new Set(["TEMPORARY_SERVICE", "SERVICE_REINFORCEMENT", "SERVICE_SUBSTITUTION"]);
  const sommeTransactions = (filtre) => analyse.transactionsNouvelles.reduce((total, transaction) => filtre(String(transaction?.kind || "")) ? total + nombre(transaction?.amount) : total, 0);
  const attenduInvestissement = sommeTransactions(kind => kindsInvestissement.has(kind));
  const attenduExploitation = sommeTransactions(kind => kindsExploitation.has(kind));

  if (analyse.transactionsNouvelles.length > 0 && ancien.unlimitedMoney !== true && nouveau.unlimitedMoney !== true) {
    const deltaTransactions = analyse.transactionsNouvelles.reduce((total, transaction) => total - nombre(transaction?.amount), 0);
    if (Math.abs(deltaTresorerie - deltaTransactions) > 1.01) throw new Error("La variation de trésorerie ne correspond pas aux transactions de l'action.");
  }
  if (Math.abs((nombre(nouveau.totalSpent) - nombre(ancien.totalSpent)) - attenduInvestissement) > 1.01) throw new Error("Le total des dépenses ne correspond pas aux investissements de l'action.");
  if (Math.abs((nombre(nouveau.totalInvestment) - nombre(ancien.totalInvestment)) - attenduInvestissement) > 1.01) throw new Error("Le total des investissements ne correspond pas aux transactions de l'action.");
  if (Math.abs((nombre(nouveau.totalOperatingCosts) - nombre(ancien.totalOperatingCosts)) - attenduExploitation) > 1.01) throw new Error("Les coûts d'exploitation ne correspondent pas aux services engagés.");

  for (const cle of ["totalRevenue", "totalPassengerRevenue", "totalFineRevenue", "totalPublicDevelopmentFunding", "totalObjectiveRewards", "totalCompensationPaid"]) {
    if (Math.abs(nombre(nouveau[cle]) - nombre(ancien[cle])) > 0.01) throw new Error(`Le champ financier ${cle} est calculé par la simulation et ne peut pas être modifié directement.`);
  }
  const deltaSubventions = nombre(nouveau.totalSubsidies) - nombre(ancien.totalSubsidies);
  if (analyse.eventDecision) {
    if (Math.abs(deltaTresorerie - nombre(analyse.eventBalanceImpact)) > 0.01) throw new Error("La trésorerie ne correspond pas à la décision d'événement.");
    if (Math.abs(deltaSubventions - nombre(analyse.eventSubsidyImpact)) > 0.01) throw new Error("Les subventions ne correspondent pas à la décision d'événement.");
  } else if (Math.abs(deltaSubventions) > 0.01) {
    throw new Error("Le total des subventions est calculé par la simulation et ne peut pas être modifié directement.");
  }

  const hausseTresorerie = deltaTresorerie;
  if (hausseTresorerie > 0.01 && permissions.gerer_finances !== true) {
    const recetteAutorisee = analyse.eventDecision === true && permissions.gerer_evenements === true
      || analyse.transactionsNouvelles.some(transaction => {
        const kind = String(transaction?.kind || "");
        return (kind === "VEHICLE_SALE" && permissions.gerer_materiel_roulant === true)
          || (kind === "DEBT_BORROW" && permissions.gerer_emprunts === true);
      });
    if (!recetteAutorisee) throw new Error("Cette action ne peut pas créditer directement la trésorerie.");
  }
  return analyse;
}

function normaliserCodePartieOnline(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function creerCodePartieOnline(longueur = 6) {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  let code = "";
  for (const octet of octets) {
    code += CLU_ONLINE_ALPHABET_CODE[octet & 31];
  }
  return code;
}

function identiteCleOnline(identite) {
  if (identite?.estInvite) return `g:${normaliserPseudo(identite.pseudo || "")}`;
  return `u:${String(identite?.id || "")}`;
}

function creerJetonOnline() {
  const octets = new Uint8Array(32);
  crypto.getRandomValues(octets);
  return octetsVersBase64Url(octets);
}

function valeurTexteOnline(value, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function estVisibiliteOnline(value) {
  return value === "privee" || value === "publique_code" || value === "ouverte";
}

function estBudgetModeOnline(value) {
  return value === "global" || value === "divise";
}

function verifierProtocoleOnline(request) {
  const url = new URL(request.url);
  const protocole = Number(url.searchParams.get("protocole"));
  if (protocole === CLU_ONLINE_PROTOCOL_VERSION) return null;
  return reponseJson({
    ok: false,
    codeErreur: "PROTOCOLE_ONLINE_INCOMPATIBLE",
    erreur: "Votre version de CLU Métropole n'est pas compatible avec le service En ligne actuellement déployé. Rechargez complètement la page.",
    protocoleAttendu: CLU_ONLINE_PROTOCOL_VERSION,
  }, 426, { "Cache-Control": "no-store" });
}

function sanitiserConfigOnline(corps) {
  const carte = corps?.carte && typeof corps.carte === "object"
    ? {
        id: valeurTexteOnline(corps.carte.id, 120) || null,
        nom: valeurTexteOnline(corps.carte.nom, 120) || null,
      }
    : { id: null, nom: null };

  const budgetInitialBrut = Number(corps?.budgetInitial);
  const budgetInitial = Number.isFinite(budgetInitialBrut)
    ? Math.max(0, Math.min(budgetInitialBrut, 1_000_000_000_000))
    : null;

  return {
    carte,
    budgetInitial,
    budgetMode: estBudgetModeOnline(corps?.budgetMode) ? corps.budgetMode : "global",
    lectureSeuleParDefaut: corps?.lectureSeuleParDefaut !== false,
  };
}

async function trouverPartieOnlineParCode(env, code, inclureInactive = false) {
  const codeNormalise = normaliserCodePartieOnline(code);
  if (!codeNormalise) return null;
  const whereActive = inclureInactive ? "" : "AND actif = 1";
  return await env.db.prepare(`
    SELECT
      id, code, nom, administrateur_id, administrateur_pseudo,
      visibilite, statut, carte_id, carte_nom, budget_mode,
      lecture_seule_par_defaut, places_max, joueurs_connectes,
      entrees_ouvertes, date_creation, date_modification, actif
    FROM parties_en_ligne
    WHERE code = ? ${whereActive}
    LIMIT 1
  `).bind(codeNormalise).first();
}

function stubPartieOnline(env, partieId) {
  const id = env.CLU_ONLINE.idFromName(String(partieId));
  return env.CLU_ONLINE.get(id);
}

async function appelerPartieOnline(env, partieId, chemin, init = {}) {
  const stub = stubPartieOnline(env, partieId);
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return await stub.fetch(new Request(`https://clu-online.internal${chemin}`, {
    ...init,
    headers,
  }));
}

async function creerPartieEnLigne(request, env) {
  const session = await obtenirSession(request, env);
  if (!session) {
    return reponseJson({ ok: false, erreur: "Vous devez être connecté pour créer une partie en ligne." }, 401, {
      "Set-Cookie": cookieSessionExpire(),
    });
  }

  if (!estPremiumActif(session.premium_jusqu_a)) {
    return reponseJson({
      ok: false,
      codeErreur: "PREMIUM_REQUIS",
      erreur: "Un compte CLU Premium actif est nécessaire pour créer une partie en ligne.",
    }, 403);
  }

  if (!Boolean(session.cgu_a_jour) || !Boolean(session.age_a_jour)) {
    return reponseJson({
      ok: false,
      codeErreur: "CONDITIONS_COMPTE_REQUISES",
      erreur: "Vous devez accepter les conditions de compte à jour avant d'utiliser le mode en ligne.",
    }, 403);
  }

  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const nom = valeurTexteOnline(corps?.nom, 60);
  const visibilite = estVisibiliteOnline(corps?.visibilite) ? corps.visibilite : "privee";
  const config = sanitiserConfigOnline(corps);
  if (nom.length < 3) {
    return reponseJson({ ok: false, erreur: "Le nom de la partie doit contenir au moins 3 caractères." }, 400);
  }

  const partieId = crypto.randomUUID();
  const maintenant = Date.now();
  let code = null;

  for (let tentative = 0; tentative < 10; tentative++) {
    const candidat = creerCodePartieOnline();
    try {
      await env.db.prepare(`
        INSERT INTO parties_en_ligne (
          id, code, nom, administrateur_id, administrateur_pseudo,
          visibilite, statut, carte_id, carte_nom, budget_mode,
          lecture_seule_par_defaut, places_max, joueurs_connectes,
          entrees_ouvertes, date_creation, date_modification, actif
        ) VALUES (?, ?, ?, ?, ?, ?, 'en_cours', ?, ?, ?, ?, ?, 0, 1, ?, ?, 1)
      `).bind(
        partieId,
        candidat,
        nom,
        session.utilisateur_id,
        session.pseudo,
        visibilite,
        config.carte.id,
        config.carte.nom,
        config.budgetMode,
        config.lectureSeuleParDefaut ? 1 : 0,
        CLU_ONLINE_MAX_JOUEURS,
        maintenant,
        maintenant
      ).run();
      code = candidat;
      break;
    } catch (erreur) {
      const texte = String(erreur?.message || erreur || "");
      if (!texte.toLowerCase().includes("unique") && !texte.toLowerCase().includes("constraint")) {
        console.error("Erreur création index partie en ligne :", erreur);
        return reponseJson({ ok: false, erreur: "Impossible de créer la partie en ligne." }, 500);
      }
    }
  }

  if (!code) {
    return reponseJson({ ok: false, erreur: "Impossible de générer un code de partie unique." }, 500);
  }

  const identite = {
    id: session.utilisateur_id,
    pseudo: session.pseudo,
    estInvite: false,
    typeCompte: estPremiumActif(session.premium_jusqu_a) ? "premium" : "gratuit",
    premiumJusquA: session.premium_jusqu_a,
  };

  const responseDo = await appelerPartieOnline(env, partieId, "/initialiser", {
    method: "POST",
    body: JSON.stringify({
      partie: {
        id: partieId,
        code,
        nom,
        visibilite,
        statut: "en_cours",
        entreesOuvertes: true,
        chatActif: true,
        placesMax: CLU_ONLINE_MAX_JOUEURS,
        config,
        dateCreation: maintenant,
        premiumAdminJusquA: session.premium_jusqu_a,
      },
      administrateur: identite,
    }),
  });

  const payloadDo = await responseDo.json().catch(() => null);
  if (!responseDo.ok || !payloadDo?.ok) {
    await env.db.prepare(`DELETE FROM parties_en_ligne WHERE id = ?`).bind(partieId).run().catch(() => {});
    return reponseJson({ ok: false, erreur: payloadDo?.erreur || "Impossible d'initialiser la partie en ligne." }, 500);
  }

  return reponseJson({
    ok: true,
    partie: payloadDo.partie,
    membre: payloadDo.membre,
    jetonMembre: payloadDo.jetonMembre,
  }, 201, { "Cache-Control": "no-store" });
}

async function rejoindrePartieEnLigne(request, env) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const code = normaliserCodePartieOnline(corps?.code);
  if (code.length < 4) return reponseJson({ ok: false, erreur: "Code de partie invalide." }, 400);

  // Limitation dédiée aux essais de codes : une IP ne peut pas marteler
  // l'espace des codes de parties, même en variant le code à chaque requête.
  try {
    const limite = await env.RATE_LIMIT_ONLINE_JOIN.limit({ key: await creerCleRateLimit(request, "online-join") });
    if (!limite.success) return reponseTropDeTentatives();
  } catch (erreur) {
    console.error("Erreur rate limiter Online join :", erreur);
    return reponseJson({ ok: false, erreur: "Le service En ligne est temporairement indisponible." }, 503);
  }

  const partie = await trouverPartieOnlineParCode(env, code);
  if (!partie) {
    return reponseJson({ ok: false, codeErreur: "PARTIE_INTROUVABLE", erreur: "Cette partie en ligne n'existe pas ou n'est plus disponible." }, 404);
  }

  const jetonFourni = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
  const session = await obtenirSession(request, env);
  let identite = null;

  // Une reconnexion F5 peut présenter uniquement son jeton éphémère : le
  // Durable Object l'authentifie avant d'exiger une identité. Cela permet de
  // reprendre la session active sans recréer l'ancien système « Continuer ».
  if (jetonFourni.length < 20) {
    if (session) {
      identite = {
        id: session.utilisateur_id,
        pseudo: session.pseudo,
        estInvite: false,
        typeCompte: estPremiumActif(session.premium_jusqu_a) ? "premium" : "gratuit",
        premiumJusquA: session.premium_jusqu_a,
      };
    } else {
      const pseudoInvite = valeurTexteOnline(corps?.pseudoInvite, 24);
      if (pseudoInvite.length < 3) {
        return reponseJson({
          ok: false,
          codeErreur: "PSEUDO_INVITE_REQUIS",
          erreur: "Choisissez un pseudonyme temporaire de 3 à 24 caractères pour rejoindre sans compte.",
        }, 400);
      }
      identite = { id: `invite:${crypto.randomUUID()}`, pseudo: pseudoInvite, estInvite: true, typeCompte: "invite" };
    }
  }

  const responseDo = await appelerPartieOnline(env, partie.id, "/rejoindre", {
    method: "POST",
    body: JSON.stringify({ identite, jetonMembre: jetonFourni || null }),
  });
  const payload = await responseDo.json().catch(() => null);
  return reponseJson(payload || { ok: false, erreur: "Réponse de partie invalide." }, responseDo.status, { "Cache-Control": "no-store" });
}

async function creerTicketWebSocketPartieEnLigne(request, env) {
  let corps;
  try { corps = await request.json(); }
  catch { return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400); }

  const code = normaliserCodePartieOnline(corps?.code);
  const jetonMembre = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
  if (code.length < 4 || jetonMembre.length < 20) {
    return reponseJson({ ok: false, codeErreur: "TICKET_WS_INVALIDE", erreur: "Impossible de préparer la connexion temps réel." }, 400);
  }
  const partie = await trouverPartieOnlineParCode(env, code);
  if (!partie) return reponseJson({ ok: false, codeErreur: "PARTIE_INTROUVABLE", erreur: "Cette partie en ligne n'existe pas ou n'est plus disponible." }, 404);
  const responseDo = await appelerPartieOnline(env, partie.id, "/ws-ticket", {
    method: "POST",
    body: JSON.stringify({ jetonMembre }),
  });
  const payload = await responseDo.json().catch(() => null);
  return reponseJson(payload || { ok: false, erreur: "Réponse de partie invalide." }, responseDo.status, { "Cache-Control": "no-store" });
}

async function initialiserJeuPartieEnLigne(request, env) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const code = normaliserCodePartieOnline(corps?.code);
  const jetonMembre = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
  if (code.length < 4 || jetonMembre.length < 20 || !corps?.save || typeof corps.save !== "object") {
    return reponseJson({ ok: false, codeErreur: "INITIALISATION_INVALIDE", erreur: "L'état synchronisé de la partie est indisponible." }, 400);
  }

  const partie = await trouverPartieOnlineParCode(env, code);
  if (!partie) {
    return reponseJson({ ok: false, codeErreur: "PARTIE_INTROUVABLE", erreur: "Cette partie en ligne n'existe pas ou n'est plus disponible." }, 404);
  }

  const responseDo = await appelerPartieOnline(env, partie.id, "/jeu/initialiser", {
    method: "POST",
    body: JSON.stringify({ jetonMembre, save: corps.save }),
  });
  const payload = await responseDo.json().catch(() => null);
  return reponseJson(payload || { ok: false, erreur: "Réponse de partie invalide." }, responseDo.status, {
    "Cache-Control": "no-store",
  });
}

async function remplacerSnapshotJeuPartieEnLigne(request, env) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const code = normaliserCodePartieOnline(corps?.code);
  const jetonMembre = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
  const expectedVersion = Number(corps?.expectedVersion);
  if (code.length < 4 || jetonMembre.length < 20 || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !corps?.save || typeof corps.save !== "object") {
    return reponseJson({ ok: false, codeErreur: "SNAPSHOT_COMMIT_INVALIDE", erreur: "Le nouvel état synchronisé de la partie est invalide." }, 400);
  }

  const partie = await trouverPartieOnlineParCode(env, code);
  if (!partie) return reponseJson({ ok: false, codeErreur: "PARTIE_INTROUVABLE", erreur: "Cette partie en ligne n'existe pas ou n'est plus disponible." }, 404);

  const responseDo = await appelerPartieOnline(env, partie.id, "/jeu/snapshot", {
    method: "POST",
    body: JSON.stringify({
      jetonMembre,
      expectedVersion,
      save: corps.save,
      raison: valeurTexteOnline(corps?.raison, 40) || "snapshot",
    }),
  });
  const payload = await responseDo.json().catch(() => null);
  return reponseJson(payload || { ok: false, erreur: "Réponse de partie invalide." }, responseDo.status, { "Cache-Control": "no-store" });
}

async function quitterPartieEnLigne(request, env) {
  let corps;
  try {
    corps = await request.json();
  } catch {
    return reponseJson({ ok: false, erreur: "Le corps de la requête doit être au format JSON." }, 400);
  }

  const code = normaliserCodePartieOnline(corps?.code);
  const jetonMembre = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
  if (code.length < 4 || jetonMembre.length < 20) {
    return reponseJson({ ok: false, codeErreur: "QUITTER_INVALIDE", erreur: "Impossible de quitter cette partie en ligne." }, 400);
  }

  const partie = await trouverPartieOnlineParCode(env, code);
  if (!partie) {
    // Une session déjà fermée est considérée comme quittée côté client.
    return reponseJson({ ok: true, partieFermee: true }, 200, { "Cache-Control": "no-store" });
  }

  const responseDo = await appelerPartieOnline(env, partie.id, "/quitter", {
    method: "POST",
    body: JSON.stringify({ jetonMembre }),
  });
  const payload = await responseDo.json().catch(() => null);
  return reponseJson(payload || { ok: false, erreur: "Réponse de partie invalide." }, responseDo.status, {
    "Cache-Control": "no-store",
  });
}

async function listerPartiesOuvertesEnLigne(request, env) {
  try {
    // D1 sert d'index global, mais le Durable Object reste l'autorité réelle.
    // Une création interrompue avant le premier snapshot peut laisser une ligne
    // active dans D1 : elle ne doit jamais apparaître comme partie rejoignable.
    // La recherche est appliquée dans D1 avant la limite afin qu'une partie reste
    // trouvable même si elle n'est pas dans les 30 premières cartes de l'annuaire.
    const recherche = valeurTexteOnline(new URL(request.url).searchParams.get("recherche"), 60).toLocaleLowerCase();
    const filtreRecherche = recherche ? `
        AND (instr(lower(nom), ?) > 0 OR instr(lower(administrateur_pseudo), ?) > 0)` : "";
    const requete = env.db.prepare(`
      SELECT
        id, code, nom, administrateur_pseudo, statut, carte_id, carte_nom,
        budget_mode, lecture_seule_par_defaut, places_max, joueurs_connectes,
        entrees_ouvertes, date_creation, date_modification
      FROM parties_en_ligne
      WHERE actif = 1
        AND visibilite = 'ouverte'
        AND entrees_ouvertes = 1
        AND statut IN ('lobby', 'en_cours')
        AND joueurs_connectes < places_max
        ${filtreRecherche}
      ORDER BY joueurs_connectes DESC, date_modification DESC
      LIMIT 30
    `);
    const resultat = recherche
      ? await requete.bind(recherche, recherche).all()
      : await requete.all();

    const candidates = resultat?.results || [];
    const verifications = await Promise.all(candidates.map(async row => {
      try {
        const responseDo = await appelerPartieOnline(env, row.id, "/annuaire", { method: "GET" });
        if (!responseDo.ok) return null;
        const autorite = await responseDo.json().catch(() => null);
        if (!autorite?.ok || autorite.publiable !== true) return null;
        return {
          code: row.code,
          nom: row.nom,
          administrateurPseudo: row.administrateur_pseudo,
          statut: row.statut,
          carte: { id: row.carte_id, nom: row.carte_nom },
          budgetMode: row.budget_mode,
          lectureSeuleParDefaut: Boolean(row.lecture_seule_par_defaut),
          placesMax: Number(row.places_max) || CLU_ONLINE_MAX_JOUEURS,
          joueursConnectes: Number(autorite.joueursConnectes) || 0,
          dateCreation: row.date_creation,
          dateModification: row.date_modification,
        };
      } catch {
        return null;
      }
    }));

    // Déduplication défensive par code. La contrainte SQL doit déjà garantir
    // l'unicité, mais l'API ne renvoie jamais deux cartes pour le même code.
    const uniques = new Map();
    for (const partie of verifications) {
      if (!partie?.code || uniques.has(partie.code)) continue;
      uniques.set(partie.code, partie);
    }

    return reponseJson({
      ok: true,
      parties: [...uniques.values()].slice(0, 50),
    }, 200, { "Cache-Control": "no-store" });
  } catch (erreur) {
    console.error("Erreur annuaire parties en ligne :", erreur);
    return reponseJson({
      ok: false,
      codeErreur: "ANNUAIRE_INDISPONIBLE",
      erreur: "L'annuaire des parties ouvertes est temporairement indisponible.",
    }, 503, { "Cache-Control": "no-store" });
  }
}
async function infosPartieEnLigne(request, env) {
  const url = new URL(request.url);
  const code = normaliserCodePartieOnline(url.searchParams.get("code"));
  const partie = await trouverPartieOnlineParCode(env, code);
  if (!partie) {
    return reponseJson({ ok: false, erreur: "Partie introuvable." }, 404);
  }
  return reponseJson({
    ok: true,
    partie: {
      code: partie.code,
      nom: partie.nom,
      administrateurPseudo: partie.administrateur_pseudo,
      visibilite: partie.visibilite,
      statut: partie.statut,
      carte: { id: partie.carte_id, nom: partie.carte_nom },
      budgetMode: partie.budget_mode,
      lectureSeuleParDefaut: Boolean(partie.lecture_seule_par_defaut),
      entreesOuvertes: Boolean(partie.entrees_ouvertes),
      placesMax: partie.places_max,
      joueursConnectes: partie.joueurs_connectes,
    },
  }, 200, { "Cache-Control": "no-store" });
}

async function websocketPartieEnLigne(request, env) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return reponseJson({ ok: false, erreur: "Connexion WebSocket requise." }, 426);
  }

  const url = new URL(request.url);
  const code = normaliserCodePartieOnline(url.searchParams.get("code"));
  const ticket = String(url.searchParams.get("ticket") || "");
  if (!code || ticket.length < 20) {
    return reponseJson({ ok: false, erreur: "Paramètres de connexion en ligne invalides." }, 400);
  }

  const partie = await trouverPartieOnlineParCode(env, code);
  if (!partie) {
    return reponseJson({ ok: false, erreur: "Partie introuvable ou hors ligne." }, 404);
  }

  const stub = stubPartieOnline(env, partie.id);

  // IMPORTANT WebSocket : transmettre la requête d'upgrade originale au
  // Durable Object. Recréer une Request en recopiant seulement les headers
  // peut perdre des informations internes nécessaires au handshake 101 selon
  // le runtime Cloudflare. Le DO accepte donc directement le chemin public.
  return await stub.fetch(request);
}

export class CluOnlinePartie {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.etatCharge = null;
    this.jeuCourant = null;
    this.chatRate = new Map();
    this.mutationRate = new Map();
    this.ctx.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async chargerEtat() {
    if (!this.etatCharge) {
      this.etatCharge = (async () => (await this.ctx.storage.get("etat")) || null)();
    }
    return await this.etatCharge;
  }

  async sauvegarderEtat(etat) {
    this.etatCharge = Promise.resolve(etat);
    await this.ctx.storage.put("etat", etat);
  }

  async json(request) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  socketsMembre(membreId, exclure = null) {
    return this.ctx.getWebSockets().filter(ws => {
      if (ws === exclure) return false;
      try {
        const att = ws.deserializeAttachment();
        return att?.membreId === membreId && ws.readyState === WebSocket.OPEN;
      } catch {
        return false;
      }
    });
  }

  idsMembresConnectes() {
    const ids = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      try {
        const att = ws.deserializeAttachment();
        if (att?.membreId) ids.add(att.membreId);
      } catch {}
    }
    return ids;
  }

  placesOccupees(etat, maintenant = Date.now()) {
    const connectes = this.idsMembresConnectes();
    const reserves = new Set();
    for (const membre of Object.values(etat.membres || {})) {
      if (membre.statut !== "accepte") continue;
      if (connectes.has(membre.id)) continue;
      if (Number(membre.reserveJusquA) > maintenant) reserves.add(membre.id);
    }
    return connectes.size + reserves.size;
  }

  serialiserMembre(membre, admin = false) {
    const connecte = this.socketsMembre(membre.id).length > 0;
    const base = {
      id: membre.id,
      pseudo: membre.pseudo,
      estInvite: Boolean(membre.estInvite),
      typeCompte: membre.typeCompte,
      role: membre.role,
      statut: membre.statut,
      connecte,
      muet: Boolean(membre.muet),
      dateArrivee: membre.dateArrivee,
      graceJusquA: Number(membre.reserveJusquA) > Date.now() ? Number(membre.reserveJusquA) : null,
      demandeExpireA: membre.statut === "en_attente" && Number(membre.demandeExpireA) > Date.now() ? Number(membre.demandeExpireA) : null,
    };
    if (admin || membre.role === "administrateur") base.permissions = { ...membre.permissions };
    return base;
  }

  membreBudgetEligible(membre) {
    if (!membre || membre.statut !== "accepte") return false;
    if (membre.role === "administrateur") return true;
    const permissions = membre.permissions || {};
    return permissions.effectuer_depenses === true
      || permissions.gerer_finances === true
      || permissions.gerer_budget === true
      || permissions.gerer_emprunts === true
      || permissions.gerer_subventions === true;
  }

  montantBudgetOnline(valeur) {
    const nombre = Number(valeur);
    if (!Number.isFinite(nombre)) return 0;
    return Math.max(0, Math.round(nombre * 100) / 100);
  }

  soldeJeuOnline(save) {
    return this.montantBudgetOnline(save?.data?.economy?.balance);
  }

  budgetNormalise(etat, totalForce = null) {
    const total = this.montantBudgetOnline(totalForce ?? etat?.budget?.totalDisponible ?? etat?.partie?.config?.budgetInitial ?? 0);
    const mode = etat?.partie?.config?.budgetMode === "divise" ? "divise" : "global";
    if (mode === "global") {
      return { mode, totalDisponible: total, reserveCommune: total, allocations: {}, dateModification: Date.now() };
    }

    const source = etat?.budget && typeof etat.budget === "object" ? etat.budget : {};
    const allocations = {};
    let somme = 0;
    for (const [membreId, brut] of Object.entries(source.allocations || {})) {
      const membre = etat.membres?.[membreId];
      if (!this.membreBudgetEligible(membre)) continue;
      const montant = this.montantBudgetOnline(brut);
      allocations[membreId] = montant;
      somme += montant;
    }
    somme = this.montantBudgetOnline(somme);

    // Si la simulation a réduit la trésorerie sous le total des enveloppes,
    // les enveloppes sont réduites proportionnellement. Une hausse globale va
    // dans la réserve commune, pas dans le portefeuille arbitraire de l'admin.
    if (somme > total && somme > 0) {
      const ids = Object.keys(allocations);
      let distribue = 0;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const montant = i === ids.length - 1
          ? this.montantBudgetOnline(total - distribue)
          : this.montantBudgetOnline(total * allocations[id] / somme);
        allocations[id] = montant;
        distribue = this.montantBudgetOnline(distribue + montant);
      }
      somme = this.montantBudgetOnline(Object.values(allocations).reduce((acc, valeur) => acc + Number(valeur || 0), 0));
    }

    return {
      mode,
      totalDisponible: total,
      reserveCommune: this.montantBudgetOnline(Math.max(0, total - somme)),
      allocations,
      dateModification: Date.now(),
    };
  }

  budgetInitialDepuisJeu(etat, save) {
    const total = this.soldeJeuOnline(save);
    if (etat.partie.config?.budgetMode !== "divise") return this.budgetNormalise(etat, total);
    const eligibles = Object.values(etat.membres || {}).filter(membre => this.membreBudgetEligible(membre));
    if (!eligibles.length) return { mode: "divise", totalDisponible: total, reserveCommune: total, allocations: {}, dateModification: Date.now() };
    const allocations = {};
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / eligibles.length);
    let reste = cents - base * eligibles.length;
    for (const membre of eligibles) {
      const part = base + (reste > 0 ? 1 : 0);
      if (reste > 0) reste -= 1;
      allocations[membre.id] = part / 100;
    }
    return { mode: "divise", totalDisponible: total, reserveCommune: 0, allocations, dateModification: Date.now() };
  }

  budgetApresMutation(etat, membre, avant, apres) {
    const avantSolde = this.soldeJeuOnline(avant);
    const apresSolde = this.soldeJeuOnline(apres);
    const budget = this.budgetNormalise(etat, avantSolde);
    if (budget.mode !== "divise") return this.budgetNormalise({ ...etat, budget }, apresSolde);

    const delta = Math.round((apresSolde - avantSolde) * 100) / 100;
    const allocation = this.montantBudgetOnline(budget.allocations[membre.id] || 0);
    if (delta < -0.005) {
      const cout = this.montantBudgetOnline(-delta);
      if (!this.membreBudgetEligible(membre) || allocation + 0.005 < cout) {
        const erreur = new Error("Budget individuel insuffisant pour cette dépense.");
        erreur.codeErreur = "BUDGET_INDIVIDUEL_INSUFFISANT";
        throw erreur;
      }
      budget.allocations[membre.id] = this.montantBudgetOnline(allocation - cout);
    } else if (delta > 0.005) {
      if (this.membreBudgetEligible(membre)) budget.allocations[membre.id] = this.montantBudgetOnline(allocation + delta);
      else budget.reserveCommune = this.montantBudgetOnline(budget.reserveCommune + delta);
    }
    budget.totalDisponible = apresSolde;
    const somme = this.montantBudgetOnline(Object.values(budget.allocations).reduce((acc, valeur) => acc + Number(valeur || 0), 0));
    budget.reserveCommune = this.montantBudgetOnline(Math.max(0, apresSolde - somme));
    budget.dateModification = Date.now();
    return budget;
  }

  budgetApresSnapshot(etat, save) {
    return this.budgetNormalise(etat, this.soldeJeuOnline(save));
  }

  repartirBudgetEgalement(etat) {
    const total = this.montantBudgetOnline(etat?.budget?.totalDisponible ?? etat?.partie?.config?.budgetInitial ?? 0);
    const eligibles = Object.values(etat.membres || {}).filter(membre => this.membreBudgetEligible(membre));
    if (!eligibles.length) return { mode: "divise", totalDisponible: total, reserveCommune: total, allocations: {}, dateModification: Date.now() };
    const allocations = {};
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / eligibles.length);
    let reste = cents - base * eligibles.length;
    for (const membre of eligibles) {
      const part = base + (reste > 0 ? 1 : 0);
      if (reste > 0) reste -= 1;
      allocations[membre.id] = part / 100;
    }
    return { mode: "divise", totalDisponible: total, reserveCommune: 0, allocations, dateModification: Date.now() };
  }

  vueBudget(etat, membreDemandeur) {
    const budget = this.budgetNormalise(etat);
    const estAdmin = membreDemandeur?.role === "administrateur";
    const repartition = estAdmin
      ? Object.values(etat.membres || {})
          .filter(membre => this.membreBudgetEligible(membre))
          .map(membre => ({
            membreId: membre.id,
            pseudo: membre.pseudo || "",
            montant: this.montantBudgetOnline(budget.allocations[membre.id] || 0),
          }))
      : undefined;
    return {
      mode: budget.mode,
      totalDisponible: budget.totalDisponible,
      reserveCommune: budget.reserveCommune,
      soldePersonnel: budget.mode === "divise" ? this.montantBudgetOnline(budget.allocations[membreDemandeur?.id] || 0) : null,
      repartition,
    };
  }

  vueEtat(etat, membreDemandeur) {
    const estAdmin = membreDemandeur?.role === "administrateur";
    const membres = Object.values(etat.membres || {})
      .filter(m => estAdmin || m.statut === "accepte")
      .map(m => this.serialiserMembre(m, estAdmin));
    return {
      partie: {
        ...etat.partie,
        joueursConnectes: this.idsMembresConnectes().size,
      },
      moi: membreDemandeur ? this.serialiserMembre(membreDemandeur, true) : null,
      membres,
      demandesEnAttente: estAdmin
        ? Object.values(etat.membres || {}).filter(m => m.statut === "en_attente").map(m => this.serialiserMembre(m, true))
        : [],
      bloques: estAdmin ? Object.values(etat.bloques || {}) : [],
      permissionsDisponibles: estAdmin ? CLU_ONLINE_PERMISSIONS : undefined,
      budget: this.vueBudget(etat, membreDemandeur),
      jeuVersion: Number(etat.jeuVersion) || 0,
      jeuPret: etat.jeuPret === true,
      horloge: etat.horloge || { playing: false, speed: 1, elapsedMs: 0, updatedAt: Date.now() },
    };
  }

  envoyer(ws, type, donnees = {}) {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type, ...donnees }));
    } catch {}
  }

  diffuser(type, donnees = {}, filtre = null) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      let attachment = null;
      try { attachment = ws.deserializeAttachment(); } catch {}
      if (filtre && !filtre(attachment, ws)) continue;
      this.envoyer(ws, type, donnees);
    }
  }

  diffuserEtat(etat) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      try {
        const att = ws.deserializeAttachment();
        const membre = etat.membres?.[att?.membreId];
        if (!membre) continue;
        this.envoyer(ws, "etat", this.vueEtat(etat, membre));
      } catch {}
    }
  }

  async mettreAJourIndex(etat) {
    if (!etat?.partie?.id) return;
    const connectes = this.idsMembresConnectes().size;
    await this.env.db.prepare(`
      UPDATE parties_en_ligne
      SET nom = ?, visibilite = ?, statut = ?, carte_id = ?, carte_nom = ?,
          budget_mode = ?, lecture_seule_par_defaut = ?, joueurs_connectes = ?,
          entrees_ouvertes = ?, date_modification = ?, actif = ?
      WHERE id = ?
    `).bind(
      etat.partie.nom,
      etat.partie.visibilite,
      etat.partie.statut,
      etat.partie.config?.carte?.id || null,
      etat.partie.config?.carte?.nom || null,
      etat.partie.config?.budgetMode || "global",
      etat.partie.config?.lectureSeuleParDefaut ? 1 : 0,
      connectes,
      etat.partie.entreesOuvertes ? 1 : 0,
      Date.now(),
      etat.partie.statut === "hors_ligne" || etat.partie.statut === "fermee" ? 0 : 1,
      etat.partie.id
    ).run();
  }

  async supprimerIndexPartie(etat) {
    const id = etat?.partie?.id;
    if (!id) return;
    try { await this.env.db.prepare(`DELETE FROM parties_en_ligne WHERE id = ?`).bind(id).run(); }
    catch (erreur) { console.error("Erreur suppression index session Online :", erreur); }
  }

  mutationAutorisee(membreId) {
    const maintenant = Date.now();
    const rate = this.mutationRate.get(membreId) || { debut: maintenant, nombre: 0 };
    if (maintenant - rate.debut >= CLU_ONLINE_MUTATION_RATE_WINDOW_MS) {
      rate.debut = maintenant;
      rate.nombre = 0;
    }
    if (rate.nombre >= CLU_ONLINE_MUTATION_RATE_MAX) {
      this.mutationRate.set(membreId, rate);
      return false;
    }
    rate.nombre += 1;
    this.mutationRate.set(membreId, rate);
    return true;
  }

  async detruireStockageSessionFermee() {
    // Une session terminée n'est jamais reprenable : supprimer immédiatement
    // snapshots, journal de mutations, membres et jetons du Durable Object.
    // L'index D1 correspondant est supprimé séparément à la fermeture afin
    // qu'aucune ancienne session morte ne s'accumule dans l'annuaire global.
    try { await this.ctx.storage.deleteAlarm?.(); } catch {}
    try {
      const valeurs = await this.ctx.storage.list();
      const cles = [...valeurs.keys()];
      if (cles.length) await this.ctx.storage.delete(cles);
    } catch (erreur) {
      console.error("Erreur nettoyage session Online fermée :", erreur);
    }
    this.etatCharge = Promise.resolve(null);
    this.jeuCourant = null;
    this.chatRate.clear();
    this.mutationRate.clear();
  }

  async fermerPartie(etat, raison = "administrateur_quitte") {
    if (!etat?.partie) return;
    if (etat.partie.statut === "fermee") return;
    etat.partie.statut = "fermee";
    etat.partie.entreesOuvertes = false;
    await this.sauvegarderEtat(etat);
    this.diffuser("partie_fermee", { date: Date.now(), raison });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.close(4004, "Partie fermée par l'administrateur"); } catch {}
    }
    await this.supprimerIndexPartie(etat);
    await this.detruireStockageSessionFermee();
  }

  async verifierPremiumAdministrateur(etat, fermerSiExpire = true) {
    const admin = Object.values(etat.membres || {}).find(m => m.role === "administrateur");
    if (!admin || admin.estInvite) return false;
    const row = await this.env.db.prepare(`
      SELECT premium_jusqu_a FROM utilisateurs
      WHERE id = ? AND date_suppression IS NULL
      LIMIT 1
    `).bind(admin.id).first();
    const actif = estPremiumActif(row?.premium_jusqu_a);
    if (actif) {
      etat.partie.premiumAdminJusquA = row.premium_jusqu_a;
      return true;
    }
    if (fermerSiExpire && etat.partie.statut !== "hors_ligne" && etat.partie.statut !== "fermee") {
      etat.partie.statut = "hors_ligne";
      etat.partie.entreesOuvertes = false;
      await this.sauvegarderEtat(etat);
      this.diffuser("partie_hors_ligne", { date: Date.now(), raison: "premium_expire" });
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.close(4003, "Premium administrateur expiré"); } catch {}
      }
      await this.supprimerIndexPartie(etat);
      await this.detruireStockageSessionFermee();
    }
    return false;
  }

  async programmerAlarme(etat) {
    let prochaine = null;
    const maintenant = Date.now();
    for (const membre of Object.values(etat.membres || {})) {
      const reserve = Number(membre.reserveJusquA);
      if (Number.isFinite(reserve) && reserve > maintenant) {
        prochaine = prochaine === null ? reserve : Math.min(prochaine, reserve);
      }
      const demandeExpireA = Number(membre.demandeExpireA);
      if (membre.statut === "en_attente" && Number.isFinite(demandeExpireA) && demandeExpireA > maintenant) {
        prochaine = prochaine === null ? demandeExpireA : Math.min(prochaine, demandeExpireA);
      }
    }
    const premiumAdminJusquA = Number(etat.partie?.premiumAdminJusquA);
    if (Number.isFinite(premiumAdminJusquA) && premiumAdminJusquA > maintenant) {
      prochaine = prochaine === null ? premiumAdminJusquA : Math.min(prochaine, premiumAdminJusquA);
    }
    if (prochaine !== null) await this.ctx.storage.setAlarm(prochaine + 250);
  }

  async nettoyerReservations(etat) {
    const maintenant = Date.now();
    const connectes = this.idsMembresConnectes();
    let change = false;
    for (const membre of Object.values(etat.membres || {})) {
      if (connectes.has(membre.id)) {
        if (membre.reserveJusquA || membre.demandeExpireA) {
          membre.reserveJusquA = null;
          membre.demandeExpireA = null;
          change = true;
        }
        continue;
      }
      if (membre.statut === "en_attente" && Number(membre.demandeExpireA) > 0 && Number(membre.demandeExpireA) <= maintenant) {
        delete etat.membres[membre.id];
        change = true;
        continue;
      }
      if (Number(membre.reserveJusquA) > 0 && Number(membre.reserveJusquA) <= maintenant) {
        membre.reserveJusquA = null;
        change = true;
      }
    }
    if (change) {
      etat.budget = this.budgetNormalise(etat);
      await this.sauvegarderEtat(etat);
    }
    return change;
  }


  cleMutationJeu(version) {
    return `${CLU_ONLINE_MUTATION_PREFIX}${String(version).padStart(12, "0")}`;
  }

  async lireSnapshotJeuPersistant() {
    const meta = await this.ctx.storage.get(CLU_ONLINE_SNAPSHOT_META_KEY);
    if (!meta || typeof meta.generation !== "string" || !Number.isFinite(Number(meta.version)) || !Number.isInteger(Number(meta.chunks)) || meta.chunks < 1 || meta.chunks > 128) return null;
    let texte = "";
    for (let index = 0; index < meta.chunks; index++) {
      const chunk = await this.ctx.storage.get(`${CLU_ONLINE_SNAPSHOT_CHUNK_PREFIX}${meta.generation}:${String(index).padStart(4, "0")}`);
      if (typeof chunk !== "string") return null;
      texte += chunk;
    }
    try {
      const save = JSON.parse(texte);
      return sauvegardeJeuOnlineValide(save) ? { version: Number(meta.version), save } : null;
    } catch {
      return null;
    }
  }

  async ecrireSnapshotJeuPersistant(version, save) {
    const texte = JSON.stringify(save);
    if (texte.length > CLU_ONLINE_MAX_SNAPSHOT_MESSAGE) throw new Error("Snapshot de partie trop volumineux.");
    const chunks = [];
    for (let offset = 0; offset < texte.length; offset += CLU_ONLINE_SNAPSHOT_CHUNK_SIZE) {
      chunks.push(texte.slice(offset, offset + CLU_ONLINE_SNAPSHOT_CHUNK_SIZE));
    }
    const ancienMeta = await this.ctx.storage.get(CLU_ONLINE_SNAPSHOT_META_KEY);
    const generation = crypto.randomUUID();
    for (let index = 0; index < chunks.length; index++) {
      await this.ctx.storage.put(`${CLU_ONLINE_SNAPSHOT_CHUNK_PREFIX}${generation}:${String(index).padStart(4, "0")}`, chunks[index]);
    }
    await this.ctx.storage.put(CLU_ONLINE_SNAPSHOT_META_KEY, { generation, version, chunks: chunks.length, date: Date.now() });
    if (typeof ancienMeta?.generation === "string" && ancienMeta.generation !== generation) {
      const anciennes = [];
      for (let index = 0; index < (Number(ancienMeta.chunks) || 0); index++) anciennes.push(`${CLU_ONLINE_SNAPSHOT_CHUNK_PREFIX}${ancienMeta.generation}:${String(index).padStart(4, "0")}`);
      if (anciennes.length) await this.ctx.storage.delete(anciennes);
    }
  }

  async chargerJeuCourant(etat) {
    const versionCible = Number(etat.jeuVersion) || 0;
    if (!etat.jeuPret || versionCible < 1) return null;
    if (this.jeuCourant?.version === versionCible && sauvegardeJeuOnlineValide(this.jeuCourant.save)) return this.jeuCourant;

    const snapshot = await this.lireSnapshotJeuPersistant();
    if (!snapshot) return null;
    const save = clonerValeurOnline(snapshot.save);
    let version = snapshot.version;
    const mutations = await this.ctx.storage.list({ prefix: CLU_ONLINE_MUTATION_PREFIX });
    const ordonnees = [...mutations.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, mutation] of ordonnees) {
      const mutationVersion = Number(mutation?.version) || 0;
      if (mutationVersion <= version || mutationVersion > versionCible) continue;
      if (mutationVersion !== version + 1 || !Array.isArray(mutation?.patches)) return null;
      appliquerPatchesJeuOnline(save, mutation.patches);
      version = mutationVersion;
    }
    if (version !== versionCible) return null;
    this.jeuCourant = { version, save };
    return this.jeuCourant;
  }

  async envoyerSnapshotJeu(ws, etat, raison = "resynchronisation") {
    const courant = await this.chargerJeuCourant(etat);
    if (!courant) {
      this.envoyer(ws, "erreur", { codeErreur: "SNAPSHOT_INDISPONIBLE", erreur: "L'état synchronisé de la partie est indisponible." });
      return false;
    }
    this.envoyer(ws, "jeu_snapshot", { version: courant.version, save: courant.save, raison });
    return true;
  }

  async compacterJeu(etat, courant) {
    await this.ecrireSnapshotJeuPersistant(courant.version, courant.save);
    const mutations = await this.ctx.storage.list({ prefix: CLU_ONLINE_MUTATION_PREFIX });
    const aSupprimer = [];
    for (const [cle, mutation] of mutations.entries()) {
      if ((Number(mutation?.version) || 0) <= courant.version) aSupprimer.push(cle);
    }
    if (aSupprimer.length) await this.ctx.storage.delete(aSupprimer);
  }

  async traiterHorlogeJeu(ws, etat, membre, paquet) {
    if (membre.statut !== "accepte" || (membre.role !== "administrateur" && membre.permissions?.gerer_temps_simulation !== true)) {
      this.envoyer(ws, "erreur", { codeErreur: "PERMISSION_TEMPS_REQUISE", erreur: "Vous n'avez pas la permission de contrôler le temps de la partie." });
      return;
    }
    const source = paquet?.horloge;
    const speed = Number(source?.speed);
    const elapsedMs = Number(source?.elapsedMs);
    if (!source || typeof source.playing !== "boolean" || ![0.5, 1, 2].includes(speed) || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 300_000) {
      this.envoyer(ws, "erreur", { codeErreur: "HORLOGE_INVALIDE", erreur: "État de l'horloge invalide." });
      return;
    }
    etat.horloge = { playing: source.playing, speed, elapsedMs: Math.round(elapsedMs), updatedAt: Date.now() };
    await this.sauvegarderEtat(etat);
    this.diffuser("jeu_horloge", { horloge: etat.horloge }, (att) => etat.membres?.[att?.membreId]?.statut === "accepte");
  }

  async traiterCommandeSimulation(ws, etat, membre, paquet) {
    if (membre.statut !== "accepte" || (membre.role !== "administrateur" && membre.permissions?.gerer_temps_simulation !== true)) {
      this.envoyer(ws, "erreur", { codeErreur: "PERMISSION_TEMPS_REQUISE", erreur: "Vous n'avez pas la permission de contrôler la simulation." });
      return;
    }
    if (paquet?.commande !== "jour_suivant") {
      this.envoyer(ws, "erreur", { codeErreur: "COMMANDE_SIMULATION_INVALIDE", erreur: "Commande de simulation invalide." });
      return;
    }
    const admin = Object.values(etat.membres || {}).find(item => item?.role === "administrateur" && item?.statut === "accepte");
    if (!admin) {
      this.envoyer(ws, "erreur", { codeErreur: "ADMIN_ABSENT", erreur: "L'administrateur n'est pas disponible pour exécuter cette commande." });
      return;
    }
    const socketsAdmin = this.socketsMembre(admin.id);
    if (!socketsAdmin.length) {
      this.envoyer(ws, "erreur", { codeErreur: "ADMIN_ABSENT", erreur: "L'administrateur doit être connecté pour passer au jour suivant." });
      return;
    }
    const id = typeof paquet?.id === "string" && paquet.id ? paquet.id.slice(0, 100) : crypto.randomUUID();
    this.envoyer(socketsAdmin[0], "jeu_commande_simulation", { id, commande: "jour_suivant", demandeurId: membre.id });
  }

  async initialiserEtatJeu(etat, membre, saveSource) {
    if (membre.statut !== "accepte" || membre.role !== "administrateur") {
      return { ok: false, status: 403, codeErreur: "ADMIN_REQUIS", erreur: "Seul l'administrateur peut initialiser l'état de la métropole." };
    }
    if (!(await this.verifierPremiumAdministrateur(etat, true))) {
      return { ok: false, status: 403, codeErreur: "PREMIUM_EXPIRE", erreur: "Le Premium de l'administrateur n'est plus actif." };
    }
    if (etat.jeuPret === true && Number(etat.jeuVersion) > 0) {
      const courant = await this.chargerJeuCourant(etat);
      if (courant) return { ok: true, status: 200, version: courant.version, dejaInitialise: true };
      // État incohérent hérité d'une initialisation interrompue : permettre une
      // réparation idempotente depuis la sauvegarde de l'administrateur.
      etat.jeuPret = false;
      etat.jeuVersion = 0;
      etat.jeuActionsRecentes = [];
    }
    if (!sauvegardeJeuOnlineValide(saveSource)) {
      return { ok: false, status: 400, codeErreur: "SNAPSHOT_INVALIDE", erreur: "Le snapshot initial de la métropole est invalide." };
    }

    const save = clonerValeurOnline(saveSource);
    const version = 1;
    try {
      await this.ecrireSnapshotJeuPersistant(version, save);
      this.jeuCourant = { version, save };
      etat.jeuPret = true;
      etat.jeuVersion = version;
      etat.jeuActionsRecentes = [];
      etat.budget = this.budgetInitialDepuisJeu(etat, save);
      await this.sauvegarderEtat(etat);
      await this.mettreAJourIndex(etat);
      this.diffuser("jeu_snapshot", { version, save, raison: "initialisation" }, (att) => {
        const cible = etat.membres?.[att?.membreId];
        return cible?.statut === "accepte" && cible.id !== membre.id;
      });
      this.diffuserEtat(etat);
      return { ok: true, status: 200, version, dejaInitialise: false };
    } catch (cause) {
      console.error("Erreur initialisation snapshot Online :", cause);
      return { ok: false, status: 500, codeErreur: "SNAPSHOT_ECRITURE_ECHEC", erreur: "L'état synchronisé de la partie est indisponible." };
    }
  }

  async remplacerSnapshotJeu(etat, membre, expectedVersion, saveSource, raison = "snapshot") {
    if (membre.statut !== "accepte" || membre.role !== "administrateur") {
      return { ok: false, status: 403, codeErreur: "ADMIN_REQUIS", erreur: "Seul l'administrateur peut publier un snapshot autoritaire." };
    }
    if (!(await this.verifierPremiumAdministrateur(etat, true))) {
      return { ok: false, status: 403, codeErreur: "PREMIUM_EXPIRE", erreur: "Le Premium de l'administrateur n'est plus actif." };
    }
    const versionCourante = Number(etat.jeuVersion) || 0;
    if (!etat.jeuPret || versionCourante < 1) {
      return { ok: false, status: 409, codeErreur: "JEU_NON_INITIALISE", erreur: "La métropole n'est pas encore synchronisée.", versionCourante };
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion !== versionCourante) {
      return { ok: false, status: 409, codeErreur: "VERSION_DIVERGENTE", erreur: "La partie a changé pendant la synchronisation.", versionCourante };
    }
    try {
      validerStructureSauvegardeOnline(saveSource);
      const save = clonerValeurOnline(saveSource);
      const version = versionCourante + 1;
      await this.ecrireSnapshotJeuPersistant(version, save);
      const mutations = await this.ctx.storage.list({ prefix: CLU_ONLINE_MUTATION_PREFIX });
      if (mutations.size) await this.ctx.storage.delete([...mutations.keys()]);
      this.jeuCourant = { version, save };
      etat.jeuVersion = version;
      etat.jeuPret = true;
      etat.jeuActionsRecentes = [];
      etat.budget = this.budgetApresSnapshot(etat, save);
      await this.sauvegarderEtat(etat);
      this.diffuser("jeu_snapshot", { version, save, raison: raison === "simulation" ? "simulation" : "resynchronisation" }, (att) => {
        const cible = etat.membres?.[att?.membreId];
        return cible?.statut === "accepte" && cible.id !== membre.id;
      });
      this.diffuserEtat(etat);
      return { ok: true, status: 200, version };
    } catch (cause) {
      console.error("Erreur remplacement snapshot Online :", cause);
      return { ok: false, status: 400, codeErreur: "SNAPSHOT_COMMIT_REFUSE", erreur: "Le nouvel état synchronisé de la partie a été refusé." };
    }
  }

  async traiterInitialisationJeu(ws, etat, membre, paquet) {
    const resultat = await this.initialiserEtatJeu(etat, membre, paquet?.save);
    if (!resultat.ok) {
      this.envoyer(ws, "erreur", { codeErreur: resultat.codeErreur, erreur: resultat.erreur });
      return;
    }
    this.envoyer(ws, "jeu_snapshot_initialise", { version: resultat.version });
    if (resultat.dejaInitialise) await this.envoyerSnapshotJeu(ws, etat, "resynchronisation");
  }

  async traiterMutationJeu(ws, etat, membre, paquet, tailleMessage) {
    if (membre.statut !== "accepte") return this.envoyer(ws, "erreur", { codeErreur: "ACCES_REQUIS", erreur: "Vous n'êtes pas autorisé à modifier cette partie." });
    if (!etat.jeuPret || Number(etat.jeuVersion) < 1) return this.envoyer(ws, "erreur", { codeErreur: "JEU_NON_INITIALISE", erreur: "La métropole n'est pas encore synchronisée." });
    if (tailleMessage > CLU_ONLINE_MAX_MUTATION_MESSAGE) return this.envoyer(ws, "erreur", { codeErreur: "MUTATION_TROP_GRANDE", erreur: "Cette modification est trop volumineuse." });

    const actionId = typeof paquet?.actionId === "string" ? paquet.actionId.slice(0, 100) : "";
    const expectedVersion = Number(paquet?.expectedVersion);
    const patches = Array.isArray(paquet?.patches) ? paquet.patches : [];
    if (!actionId || !Number.isInteger(expectedVersion) || patches.length < 1 || patches.length > CLU_ONLINE_MAX_PATCHES) {
      return this.envoyer(ws, "erreur", { codeErreur: "MUTATION_INVALIDE", erreur: "Mutation de jeu invalide." });
    }

    const deja = Array.isArray(etat.jeuActionsRecentes) ? etat.jeuActionsRecentes.find(item => item?.id === actionId) : null;
    const versionCourante = Number(etat.jeuVersion) || 0;
    if (deja) {
      this.envoyer(ws, "jeu_mutation_confirmee", { actionId, version: deja.version, versionCourante });
      return;
    }
    if (expectedVersion !== versionCourante) {
      this.envoyer(ws, "jeu_resync_requise", { version: versionCourante });
      return;
    }

    const courant = await this.chargerJeuCourant(etat);
    if (!courant) {
      this.envoyer(ws, "jeu_resync_requise", { version: versionCourante });
      return;
    }

    let candidat;
    let budgetSuivant;
    try {
      candidat = clonerValeurOnline(courant.save);
      appliquerPatchesJeuOnline(candidat, patches);
      if (!sauvegardeJeuOnlineValide(candidat)) throw new Error("La mutation rend la sauvegarde invalide.");
      validerPermissionsMutationOnline(membre, patches, courant.save, candidat);
      budgetSuivant = this.budgetApresMutation(etat, membre, courant.save, candidat);
    } catch (cause) {
      this.envoyer(ws, "erreur", {
        codeErreur: typeof cause?.codeErreur === "string" ? cause.codeErreur : "MUTATION_REFUSEE",
        erreur: typeof cause?.codeErreur === "string" ? String(cause?.message || "Modification refusée par le serveur.").slice(0, 240) : "Modification refusée par le serveur.",
        detail: String(cause?.message || cause || "Mutation refusée.").slice(0, 240),
      });
      this.envoyer(ws, "jeu_resync_requise", { version: versionCourante });
      return;
    }

    const version = versionCourante + 1;
    const mutation = { actionId, version, auteurId: membre.id, patches: clonerValeurOnline(patches), date: Date.now() };
    await this.ctx.storage.put(this.cleMutationJeu(version), mutation);
    etat.jeuVersion = version;
    etat.jeuActionsRecentes = [...(Array.isArray(etat.jeuActionsRecentes) ? etat.jeuActionsRecentes : []), { id: actionId, version }].slice(-80);
    etat.budget = budgetSuivant || this.budgetApresSnapshot(etat, candidat);
    await this.sauvegarderEtat(etat);
    this.jeuCourant = { version, save: candidat };

    this.envoyer(ws, "jeu_mutation_confirmee", { actionId, version, versionCourante: version });
    this.diffuser("jeu_mutation", mutation, (att, socket) => {
      const cible = etat.membres?.[att?.membreId];
      return socket !== ws && cible?.statut === "accepte";
    });
    // Le budget divisé fait partie de l'autorité serveur : diffuser l'état léger
    // après chaque mutation permet à tous les clients de voir immédiatement
    // leur nouvelle enveloppe sans attendre une autre action administrative.
    this.diffuserEtat(etat);
    if (version % CLU_ONLINE_SNAPSHOT_INTERVAL === 0) await this.compacterJeu(etat, this.jeuCourant);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const chemin = url.pathname;

    if (chemin === "/initialiser" && request.method === "POST") {
      const existant = await this.chargerEtat();
      if (existant) return new Response(JSON.stringify({ ok: false, erreur: "Partie déjà initialisée." }), { status: 409, headers: { "Content-Type": "application/json" } });
      const corps = await this.json(request);
      if (!corps?.partie?.id || !corps?.administrateur?.id) {
        return new Response(JSON.stringify({ ok: false, erreur: "Initialisation invalide." }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const jeton = creerJetonOnline();
      const hashJeton = await sha256(jeton);
      const admin = {
        id: corps.administrateur.id,
        cle: identiteCleOnline(corps.administrateur),
        pseudo: corps.administrateur.pseudo,
        estInvite: false,
        typeCompte: "premium",
        role: "administrateur",
        statut: "accepte",
        permissions: permissionsOnlineToutes(),
        muet: false,
        hashJeton,
        reserveJusquA: Date.now() + CLU_ONLINE_RESERVATION_MS,
        demandeExpireA: null,
        dateArrivee: Date.now(),
      };

      const etat = {
        version: 1,
        partie: { ...corps.partie, chatActif: corps.partie?.chatActif !== false },
        membres: { [admin.id]: admin },
        bloques: {},
        budget: {
          mode: corps.partie?.config?.budgetMode === "divise" ? "divise" : "global",
          totalDisponible: this.montantBudgetOnline(corps.partie?.config?.budgetInitial || 0),
          reserveCommune: this.montantBudgetOnline(corps.partie?.config?.budgetInitial || 0),
          allocations: {},
          dateModification: Date.now(),
        },
        jeuPret: false,
        jeuVersion: 0,
        jeuActionsRecentes: [],
        horloge: { playing: false, speed: 1, elapsedMs: 0, updatedAt: Date.now() },
      };
      await this.sauvegarderEtat(etat);
      await this.programmerAlarme(etat);
      return new Response(JSON.stringify({
        ok: true,
        partie: etat.partie,
        membre: this.serialiserMembre(admin, true),
        jetonMembre: jeton,
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }

    if (chemin === "/jeu/initialiser" && request.method === "POST") {
      const etat = await this.chargerEtat();
      if (!etat || ["hors_ligne", "fermee"].includes(etat.partie.statut)) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_HORS_LIGNE", erreur: "Cette partie n'est plus en ligne." }), { status: 410, headers: { "Content-Type": "application/json" } });
      }
      const corps = await this.json(request);
      const jeton = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
      if (jeton.length < 20) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "JETON_INVALIDE", erreur: "Le service en ligne a refusé la requête." }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      const hashJeton = await sha256(jeton);
      const membre = Object.values(etat.membres || {}).find(item => item.hashJeton === hashJeton);
      if (!membre) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "JETON_REFUSE", erreur: "Le service en ligne a refusé la requête." }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      const resultat = await this.initialiserEtatJeu(etat, membre, corps?.save);
      return new Response(JSON.stringify({
        ok: resultat.ok,
        version: resultat.version || 0,
        dejaInitialise: resultat.dejaInitialise === true,
        codeErreur: resultat.codeErreur,
        erreur: resultat.erreur,
      }), { status: resultat.status || (resultat.ok ? 200 : 500), headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    if (chemin === "/jeu/snapshot" && request.method === "POST") {
      const etat = await this.chargerEtat();
      if (!etat || ["hors_ligne", "fermee"].includes(etat.partie.statut)) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_HORS_LIGNE", erreur: "Cette partie n'est plus en ligne." }), { status: 410, headers: { "Content-Type": "application/json" } });
      }
      const corps = await this.json(request);
      const jeton = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
      if (jeton.length < 20) return new Response(JSON.stringify({ ok: false, codeErreur: "JETON_INVALIDE", erreur: "Le service en ligne a refusé la requête." }), { status: 401, headers: { "Content-Type": "application/json" } });
      const hashJeton = await sha256(jeton);
      const membre = Object.values(etat.membres || {}).find(item => item.hashJeton === hashJeton);
      if (!membre) return new Response(JSON.stringify({ ok: false, codeErreur: "JETON_REFUSE", erreur: "Le service en ligne a refusé la requête." }), { status: 401, headers: { "Content-Type": "application/json" } });
      const resultat = await this.remplacerSnapshotJeu(etat, membre, Number(corps?.expectedVersion), corps?.save, corps?.raison);
      return new Response(JSON.stringify({
        ok: resultat.ok,
        version: resultat.version || 0,
        versionCourante: resultat.versionCourante || 0,
        codeErreur: resultat.codeErreur,
        erreur: resultat.erreur,
      }), { status: resultat.status || (resultat.ok ? 200 : 500), headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    if (chemin === "/quitter" && request.method === "POST") {
      const etat = await this.chargerEtat();
      if (!etat) return new Response(JSON.stringify({ ok: true, partieFermee: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      const corps = await this.json(request);
      const jeton = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
      if (jeton.length < 20) return new Response(JSON.stringify({ ok: false, erreur: "Jeton invalide." }), { status: 401, headers: { "Content-Type": "application/json" } });
      const hashJeton = await sha256(jeton);
      const membre = Object.values(etat.membres || {}).find(item => item.hashJeton === hashJeton);
      if (!membre) return new Response(JSON.stringify({ ok: false, erreur: "Jeton refusé." }), { status: 401, headers: { "Content-Type": "application/json" } });

      if (membre.role === "administrateur") {
        await this.fermerPartie(etat, "administrateur_quitte");
        return new Response(JSON.stringify({ ok: true, partieFermee: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      for (const ws of this.socketsMembre(membre.id)) {
        try { ws.close(1000, "Membre parti"); } catch {}
      }
      delete etat.membres[membre.id];
      etat.budget = this.budgetNormalise(etat);
      await this.sauvegarderEtat(etat);
      await this.mettreAJourIndex(etat);
      this.diffuserEtat(etat);
      return new Response(JSON.stringify({ ok: true, partieFermee: false }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (chemin === "/annuaire" && request.method === "GET") {
      const etat = await this.chargerEtat();
      if (!etat) {
        return new Response(JSON.stringify({ ok: true, publiable: false, joueursConnectes: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // L'expiration Premium est déjà surveillée par l'alarme du Durable Object.
      // Éviter ici une lecture D1 supplémentaire par carte de l'annuaire.
      await this.nettoyerReservations(etat);
      const joueursConnectes = this.idsMembresConnectes().size;
      const admin = Object.values(etat.membres || {}).find(m => m.role === "administrateur" && m.statut === "accepte");
      const adminConnecte = Boolean(admin && this.socketsMembre(admin.id).length);
      const indisponible = ["hors_ligne", "fermee"].includes(etat.partie.statut);
      const publiable = etat.jeuPret === true
        && Number(etat.jeuVersion) > 0
        && joueursConnectes > 0
        && adminConnecte
        && etat.partie.visibilite === "ouverte"
        && etat.partie.entreesOuvertes === true
        && !indisponible
        && this.placesOccupees(etat) < etat.partie.placesMax;
      return new Response(JSON.stringify({ ok: true, publiable, joueursConnectes }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (chemin === "/rejoindre" && request.method === "POST") {
      const etat = await this.chargerEtat();
      if (!etat || ["hors_ligne", "fermee"].includes(etat.partie.statut)) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_HORS_LIGNE", erreur: "Cette partie n'est plus en ligne." }), { status: 410, headers: { "Content-Type": "application/json" } });
      }
      if (!(await this.verifierPremiumAdministrateur(etat, true))) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_HORS_LIGNE", erreur: "Le Premium de l'administrateur n'est plus actif." }), { status: 410, headers: { "Content-Type": "application/json" } });
      }
      await this.nettoyerReservations(etat);
      const corps = await this.json(request);
      const identite = corps?.identite;
      const jetonFourni = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
      const adminSession = Object.values(etat.membres || {}).find(m => m.role === "administrateur" && m.statut === "accepte");
      const adminConnecte = Boolean(adminSession && this.socketsMembre(adminSession.id).length);

      // Reconnexion par jeton : prioritaire, surtout pour l'administrateur après
      // une micro-coupure. Les autres joueurs ne peuvent pas réouvrir/reprendre
      // une session dont l'hôte n'est plus réellement présent.
      if (jetonFourni.length >= 20) {
        const hashFourni = await sha256(jetonFourni);
        const existantJeton = Object.values(etat.membres || {}).find(m => m.hashJeton === hashFourni);
        if (existantJeton && existantJeton.statut !== "refuse") {
          const cleBloquee = etat.bloques?.[existantJeton.cle];
          if (cleBloquee) {
            return new Response(JSON.stringify({ ok: false, codeErreur: "BLOQUE", erreur: "Vous êtes bloqué pour cette partie." }), { status: 403, headers: { "Content-Type": "application/json" } });
          }
          if (existantJeton.role !== "administrateur" && !adminConnecte) {
            return new Response(JSON.stringify({ ok: false, codeErreur: "HOTE_ABSENT", erreur: "L'administrateur n'héberge plus cette partie." }), { status: 410, headers: { "Content-Type": "application/json" } });
          }
          if (existantJeton.statut === "accepte" && this.placesOccupees(etat) >= etat.partie.placesMax && !this.socketsMembre(existantJeton.id).length && !(Number(existantJeton.reserveJusquA) > Date.now())) {
            return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_PLEINE", erreur: "La partie est complète." }), { status: 409, headers: { "Content-Type": "application/json" } });
          }
          existantJeton.reserveJusquA = Date.now() + CLU_ONLINE_RESERVATION_MS;
          await this.sauvegarderEtat(etat);
          await this.programmerAlarme(etat);
          return new Response(JSON.stringify({
            ok: true,
            statut: existantJeton.statut,
            partie: etat.partie,
            membre: this.serialiserMembre(existantJeton, true),
            jetonMembre: jetonFourni,
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
      }

      if (!adminConnecte) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "HOTE_ABSENT", erreur: "L'administrateur n'héberge plus cette partie." }), { status: 410, headers: { "Content-Type": "application/json" } });
      }

      if (!identite?.id || !valeurTexteOnline(identite.pseudo, 24)) {
        return new Response(JSON.stringify({ ok: false, erreur: "Identité invalide." }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      const cle = identiteCleOnline(identite);
      if (etat.bloques?.[cle]) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "BLOQUE", erreur: "Vous êtes bloqué pour cette partie." }), { status: 403, headers: { "Content-Type": "application/json" } });
      }

      let membre = Object.values(etat.membres || {}).find(m => m.cle === cle);
      // Un invité existant ne peut être repris qu'avec son jeton précédent,
      // traité plus haut. Retaper le même pseudo depuis un autre appareil ne
      // doit jamais permettre de voler son identité ni ses permissions.
      if (membre?.estInvite) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "PSEUDO_DEJA_PRESENT", erreur: "Ce pseudonyme est déjà présent dans la partie." }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      if ((!etat.jeuPret || Number(etat.jeuVersion) < 1) && membre?.role !== "administrateur") {
        return new Response(JSON.stringify({
          ok: false,
          codeErreur: "PARTIE_EN_INITIALISATION",
          erreur: "Cette partie est encore en cours de démarrage. Réessayez dans quelques instants.",
        }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      if (!membre) {
        const pseudoNormalise = normaliserPseudo(identite.pseudo);
        const doublonPseudo = Object.values(etat.membres || {}).some(m => m.statut !== "refuse" && normaliserPseudo(m.pseudo) === pseudoNormalise);
        if (doublonPseudo) {
          return new Response(JSON.stringify({ ok: false, codeErreur: "PSEUDO_DEJA_PRESENT", erreur: "Ce pseudonyme est déjà présent dans la partie." }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        const attente = Object.values(etat.membres || {}).filter(m => m.statut === "en_attente").length;
        if (attente >= CLU_ONLINE_MAX_ATTENTE) {
          return new Response(JSON.stringify({ ok: false, erreur: "Trop de demandes sont déjà en attente." }), { status: 429, headers: { "Content-Type": "application/json" } });
        }
        if (!etat.partie.entreesOuvertes) {
          return new Response(JSON.stringify({ ok: false, codeErreur: "ENTREES_FERMEES", erreur: "L'administrateur a fermé les nouvelles entrées." }), { status: 403, headers: { "Content-Type": "application/json" } });
        }

        const estPrivee = etat.partie.visibilite === "privee";
        if (!estPrivee && this.placesOccupees(etat) >= etat.partie.placesMax) {
          return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_PLEINE", erreur: "La partie est complète." }), { status: 409, headers: { "Content-Type": "application/json" } });
        }

        const jeton = creerJetonOnline();
        const hashJeton = await sha256(jeton);
        membre = {
          id: identite.id,
          cle,
          pseudo: valeurTexteOnline(identite.pseudo, 24),
          estInvite: Boolean(identite.estInvite),
          typeCompte: identite.typeCompte || "gratuit",
          role: "membre",
          statut: estPrivee ? "en_attente" : "accepte",
          permissions: etat.partie.config?.lectureSeuleParDefaut
            ? permissionsOnlineLectureSeule()
            : permissionsOnlineEdition(),
          muet: false,
          hashJeton,
          reserveJusquA: estPrivee ? null : Date.now() + CLU_ONLINE_RESERVATION_MS,
          demandeExpireA: estPrivee ? Date.now() + CLU_ONLINE_PENDING_REQUEST_MS : null,
          dateArrivee: Date.now(),
        };
        etat.membres[membre.id] = membre;
        await this.sauvegarderEtat(etat);
        await this.programmerAlarme(etat);
        this.diffuserEtat(etat);
        return new Response(JSON.stringify({
          ok: true,
          statut: membre.statut,
          partie: etat.partie,
          membre: this.serialiserMembre(membre, true),
          jetonMembre: jeton,
        }), { status: membre.statut === "en_attente" ? 202 : 200, headers: { "Content-Type": "application/json" } });
      }

      // Compte déjà membre : rotation du jeton pour permettre une reconnexion sûre.
      if (membre.statut === "accepte" && this.placesOccupees(etat) >= etat.partie.placesMax && !this.socketsMembre(membre.id).length && !(Number(membre.reserveJusquA) > Date.now())) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_PLEINE", erreur: "La partie est complète." }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      const nouveauJeton = creerJetonOnline();
      membre.hashJeton = await sha256(nouveauJeton);
      membre.pseudo = valeurTexteOnline(identite.pseudo, 24) || membre.pseudo;
      if (membre.statut === "accepte") {
        membre.reserveJusquA = Date.now() + CLU_ONLINE_RESERVATION_MS;
        membre.demandeExpireA = null;
      } else if (membre.statut === "en_attente") {
        membre.demandeExpireA = Date.now() + CLU_ONLINE_PENDING_REQUEST_MS;
      }
      await this.sauvegarderEtat(etat);
      await this.programmerAlarme(etat);
      return new Response(JSON.stringify({
        ok: true,
        statut: membre.statut,
        partie: etat.partie,
        membre: this.serialiserMembre(membre, true),
        jetonMembre: nouveauJeton,
      }), { status: membre.statut === "en_attente" ? 202 : 200, headers: { "Content-Type": "application/json" } });
    }

    if (chemin === "/ws-ticket" && request.method === "POST") {
      const etat = await this.chargerEtat();
      if (!etat || ["hors_ligne", "fermee"].includes(etat.partie.statut)) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "PARTIE_HORS_LIGNE", erreur: "Cette partie n'est plus en ligne." }), { status: 410, headers: { "Content-Type": "application/json" } });
      }
      const corps = await this.json(request);
      const jeton = typeof corps?.jetonMembre === "string" ? corps.jetonMembre : "";
      if (jeton.length < 20) return new Response(JSON.stringify({ ok: false, codeErreur: "JETON_INVALIDE", erreur: "Le service en ligne a refusé la requête." }), { status: 401, headers: { "Content-Type": "application/json" } });
      const hashJeton = await sha256(jeton);
      const membre = Object.values(etat.membres || {}).find(m => m.hashJeton === hashJeton);
      if (!membre || (membre.statut !== "accepte" && membre.statut !== "en_attente") || etat.bloques?.[membre.cle]) {
        return new Response(JSON.stringify({ ok: false, codeErreur: "JETON_REFUSE", erreur: "Le service en ligne a refusé la requête." }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      const maintenant = Date.now();
      const tickets = etat.wsTickets && typeof etat.wsTickets === "object" ? etat.wsTickets : {};
      for (const [hash, info] of Object.entries(tickets)) {
        if (!info || Number(info.expireA) <= maintenant) delete tickets[hash];
      }
      const ticket = creerJetonOnline();
      const hashTicket = await sha256(ticket);
      const expireA = maintenant + CLU_ONLINE_WS_TICKET_TTL_MS;
      tickets[hashTicket] = { membreId: membre.id, expireA };
      etat.wsTickets = tickets;
      await this.sauvegarderEtat(etat);
      return new Response(JSON.stringify({ ok: true, ticket, expireA }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    if (chemin === "/ws" || chemin === "/api/en-ligne/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket requis", { status: 426 });
      }
      const etat = await this.chargerEtat();
      if (!etat || ["hors_ligne", "fermee"].includes(etat.partie.statut)) return new Response("Partie hors ligne", { status: 410 });
      await this.nettoyerReservations(etat);
      const ticket = new URL(request.url).searchParams.get("ticket") || "";
      if (ticket.length < 20) return new Response("Ticket invalide", { status: 401 });
      const hashTicket = await sha256(ticket);
      const infoTicket = etat.wsTickets?.[hashTicket];
      if (etat.wsTickets?.[hashTicket]) delete etat.wsTickets[hashTicket];
      await this.sauvegarderEtat(etat);
      if (!infoTicket || Number(infoTicket.expireA) < Date.now()) return new Response("Ticket expiré", { status: 401 });
      const membre = etat.membres?.[infoTicket.membreId];
      if (!membre || (membre.statut !== "accepte" && membre.statut !== "en_attente")) return new Response("Ticket refusé", { status: 401 });
      if (etat.bloques?.[membre.cle]) return new Response("Bloqué", { status: 403 });

      if (membre.statut === "accepte" && !this.socketsMembre(membre.id).length) {
        const occupeesSansReservationMembre = this.placesOccupees(etat) - (Number(membre.reserveJusquA) > Date.now() ? 1 : 0);
        if (occupeesSansReservationMembre >= etat.partie.placesMax) return new Response("Partie complète", { status: 409 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ membreId: membre.id, cle: membre.cle, pseudo: membre.pseudo });
      membre.reserveJusquA = null;
      membre.demandeExpireA = null;
      await this.sauvegarderEtat(etat);
      await this.mettreAJourIndex(etat);
      this.envoyer(server, "etat", this.vueEtat(etat, membre));
      if (membre.statut === "accepte" && etat.jeuPret === true) {
        await this.envoyerSnapshotJeu(server, etat, "connexion");
      }
      if (membre.role === "administrateur") {
        this.diffuser("hote_reconnecte", { date: Date.now() }, (att) => att?.membreId !== membre.id);
      }
      this.diffuser("presence", {
        membre: this.serialiserMembre(membre, membre.role === "administrateur"),
        evenement: "connexion",
        joueursConnectes: this.idsMembresConnectes().size,
      }, (att) => att?.membreId !== membre.id);
      this.diffuserEtat(etat);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > CLU_ONLINE_MAX_WS_MESSAGE) {
      this.envoyer(ws, "erreur", { erreur: "Message invalide." });
      return;
    }
    // Fallback au mécanisme auto-response de Cloudflare : si le runtime ne
    // l'intercepte pas, le heartbeat applicatif reste fonctionnel.
    if (message === "ping") {
      try { ws.send("pong"); } catch {}
      return;
    }

    let paquet;
    try { paquet = JSON.parse(message); } catch {
      this.envoyer(ws, "erreur", { erreur: "Message JSON invalide." });
      return;
    }

    const etat = await this.chargerEtat();
    if (!etat) return;
    let att;
    try { att = ws.deserializeAttachment(); } catch { return; }
    const membre = etat.membres?.[att?.membreId];
    if (!membre || etat.bloques?.[membre.cle]) {
      try { ws.close(4003, "Accès refusé"); } catch {}
      return;
    }

    if (paquet?.type === "chat") {
      const texte = valeurTexteOnline(paquet.message, 500);
      if (!texte) return;
      if (etat.partie.chatActif === false) {
        this.envoyer(ws, "erreur", { codeErreur: "CHAT_DESACTIVE", erreur: "Le chat a été désactivé par l'administrateur." });
        return;
      }
      if (membre.statut !== "accepte" || membre.muet || membre.permissions?.chat !== true) {
        this.envoyer(ws, "erreur", { codeErreur: "CHAT_INTERDIT", erreur: "Vous ne pouvez pas écrire dans le chat." });
        return;
      }
      const maintenantChat = Date.now();
      const rate = this.chatRate.get(membre.id) || { debut: maintenantChat, nombre: 0 };
      if (maintenantChat - rate.debut >= 10_000) { rate.debut = maintenantChat; rate.nombre = 0; }
      if (rate.nombre >= 6) {
        this.envoyer(ws, "erreur", { codeErreur: "CHAT_TROP_RAPIDE", erreur: "Vous envoyez des messages trop rapidement." });
        return;
      }
      rate.nombre += 1;
      this.chatRate.set(membre.id, rate);
      // Chat volontairement éphémère : aucune écriture D1 / storage.
      this.diffuser("chat", {
        message: {
          id: crypto.randomUUID(),
          auteurId: membre.id,
          auteurPseudo: membre.pseudo,
          texte,
          date: Date.now(),
        },
      }, (a) => etat.membres?.[a?.membreId]?.statut === "accepte");
      return;
    }

    if (paquet?.type === "etat_demander") {
      this.envoyer(ws, "etat", this.vueEtat(etat, membre));
      return;
    }

    if (paquet?.type === "admin") {
      if (membre.role !== "administrateur") {
        this.envoyer(ws, "erreur", { codeErreur: "ADMIN_REQUIS", erreur: "Action réservée à l'administrateur." });
        return;
      }
      await this.actionAdmin(ws, etat, membre, paquet);
      return;
    }

    if (paquet?.type === "jeu_horloge") {
      await this.traiterHorlogeJeu(ws, etat, membre, paquet);
      return;
    }

    if (paquet?.type === "jeu_commande_simulation") {
      await this.traiterCommandeSimulation(ws, etat, membre, paquet);
      return;
    }

    if (paquet?.type === "jeu_snapshot_initialiser") {
      await this.traiterInitialisationJeu(ws, etat, membre, paquet);
      return;
    }

    if (paquet?.type === "jeu_snapshot_demander") {
      if (membre.statut !== "accepte") {
        this.envoyer(ws, "erreur", { codeErreur: "ACCES_REQUIS", erreur: "Accès à la partie requis." });
        return;
      }
      await this.envoyerSnapshotJeu(ws, etat, "resynchronisation");
      return;
    }

    if (paquet?.type === "jeu_mutation") {
      if (!this.mutationAutorisee(membre.id)) {
        this.envoyer(ws, "erreur", {
          codeErreur: "MUTATIONS_TROP_RAPIDES",
          erreur: "Trop de modifications ont été envoyées en peu de temps. La métropole va être resynchronisée.",
        });
        return;
      }
      await this.traiterMutationJeu(ws, etat, membre, paquet, message.length);
      return;
    }

    this.envoyer(ws, "erreur", { erreur: "Type de message inconnu." });
  }

  async actionAdmin(ws, etat, admin, paquet) {
    const action = String(paquet.action || "");
    const cibleId = typeof paquet.membreId === "string" ? paquet.membreId : "";
    const cible = cibleId ? etat.membres?.[cibleId] : null;

    if (!(await this.verifierPremiumAdministrateur(etat, true))) {
      return this.envoyer(ws, "erreur", { codeErreur: "PREMIUM_EXPIRE", erreur: "Le Premium de l'administrateur n'est plus actif." });
    }

    if (action === "accepter_membre") {
      if (!cible || cible.statut !== "en_attente") return this.envoyer(ws, "erreur", { erreur: "Demande introuvable." });
      if (this.placesOccupees(etat) >= etat.partie.placesMax) return this.envoyer(ws, "erreur", { codeErreur: "PARTIE_PLEINE", erreur: "La partie est complète." });
      cible.statut = "accepte";
      cible.reserveJusquA = Date.now() + CLU_ONLINE_RESERVATION_MS;
      cible.demandeExpireA = null;
      await this.sauvegarderEtat(etat);
      await this.programmerAlarme(etat);
      for (const socket of this.socketsMembre(cible.id)) {
        this.envoyer(socket, "acces_accepte", { partie: etat.partie });
        if (etat.jeuPret === true) await this.envoyerSnapshotJeu(socket, etat, "acceptation");
      }
      this.diffuserEtat(etat);
      return;
    }

    if (action === "refuser_membre") {
      if (!cible || cible.role === "administrateur") return this.envoyer(ws, "erreur", { erreur: "Membre introuvable." });
      for (const socket of this.socketsMembre(cible.id)) {
        this.envoyer(socket, "acces_refuse", {});
        try { socket.close(4003, "Accès refusé"); } catch {}
      }
      delete etat.membres[cible.id];
      etat.budget = this.budgetNormalise(etat);
      await this.sauvegarderEtat(etat);
      this.diffuserEtat(etat);
      await this.mettreAJourIndex(etat);
      return;
    }

    if (action === "expulser_membre") {
      if (!cible || cible.role === "administrateur") return this.envoyer(ws, "erreur", { erreur: "Membre introuvable." });
      const bloquer = paquet.bloquer === true;
      if (bloquer) {
        etat.bloques[cible.cle] = {
          cle: cible.cle,
          pseudo: cible.pseudo,
          estInvite: Boolean(cible.estInvite),
          dateBlocage: Date.now(),
          libelle: "Bloqué définitivement pour cette partie",
        };
      }
      for (const socket of this.socketsMembre(cible.id)) {
        this.envoyer(socket, "expulse", { bloque: bloquer });
        try { socket.close(4003, bloquer ? "Bloqué pour cette partie" : "Expulsé"); } catch {}
      }
      delete etat.membres[cible.id];
      etat.budget = this.budgetNormalise(etat);
      await this.sauvegarderEtat(etat);
      this.diffuserEtat(etat);
      await this.mettreAJourIndex(etat);
      return;
    }

    if (action === "debloquer") {
      const cle = typeof paquet.cle === "string" ? paquet.cle : "";
      if (!cle || !etat.bloques?.[cle]) return this.envoyer(ws, "erreur", { erreur: "Blocage introuvable." });
      delete etat.bloques[cle];
      await this.sauvegarderEtat(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_permissions") {
      if (!cible || cible.role === "administrateur") return this.envoyer(ws, "erreur", { erreur: "Membre introuvable." });
      cible.permissions = nettoyerPermissionsOnline(paquet.permissions, cible.permissions);
      etat.budget = this.budgetNormalise(etat);
      await this.sauvegarderEtat(etat);
      for (const socket of this.socketsMembre(cible.id)) this.envoyer(socket, "permissions_mises_a_jour", {});
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_profil") {
      if (!cible || cible.role === "administrateur") return this.envoyer(ws, "erreur", { erreur: "Membre introuvable." });
      const permissionsProfil = permissionsPourProfilOnline(paquet.profil);
      if (!permissionsProfil) return this.envoyer(ws, "erreur", { erreur: "Profil de permissions inconnu." });
      cible.permissions = permissionsProfil;
      etat.budget = this.budgetNormalise(etat);
      await this.sauvegarderEtat(etat);
      for (const socket of this.socketsMembre(cible.id)) this.envoyer(socket, "permissions_mises_a_jour", { profil: valeurTexteOnline(paquet.profil, 32) });
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_muet") {
      if (!cible || cible.role === "administrateur") return this.envoyer(ws, "erreur", { erreur: "Membre introuvable." });
      cible.muet = paquet.muet === true;
      await this.sauvegarderEtat(etat);
      for (const socket of this.socketsMembre(cible.id)) this.envoyer(socket, "moderation", { muet: cible.muet });
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_visibilite") {
      if (!estVisibiliteOnline(paquet.visibilite)) return this.envoyer(ws, "erreur", { erreur: "Visibilité invalide." });
      etat.partie.visibilite = paquet.visibilite;
      await this.sauvegarderEtat(etat);
      await this.mettreAJourIndex(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_entrees_ouvertes") {
      etat.partie.entreesOuvertes = paquet.ouvertes === true;
      await this.sauvegarderEtat(etat);
      await this.mettreAJourIndex(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_defaut_edition") {
      etat.partie.config.lectureSeuleParDefaut = paquet.editionParDefaut !== true;
      await this.sauvegarderEtat(etat);
      await this.mettreAJourIndex(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_chat_actif") {
      etat.partie.chatActif = paquet.actif !== false;
      await this.sauvegarderEtat(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (action === "definir_budget_mode") {
      if (!estBudgetModeOnline(paquet.budgetMode)) return this.envoyer(ws, "erreur", { erreur: "Mode de budget invalide." });
      etat.partie.config.budgetMode = paquet.budgetMode;
      if (paquet.budgetMode === "divise") {
        etat.budget = this.repartirBudgetEgalement(etat);
      } else {
        etat.budget = this.budgetNormalise(etat);
      }
      await this.sauvegarderEtat(etat);
      await this.mettreAJourIndex(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (action === "repartir_budget_egalement") {
      if (etat.partie.config?.budgetMode !== "divise") return this.envoyer(ws, "erreur", { erreur: "Le budget divisé n'est pas actif." });
      etat.budget = this.repartirBudgetEgalement(etat);
      await this.sauvegarderEtat(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (action === "redistribuer_budget") {
      if (etat.partie.config?.budgetMode !== "divise") return this.envoyer(ws, "erreur", { erreur: "Le budget divisé n'est pas actif." });
      const brut = paquet.repartition && typeof paquet.repartition === "object" ? paquet.repartition : null;
      if (!brut || Object.keys(brut).length > 10) return this.envoyer(ws, "erreur", { erreur: "Répartition de budget invalide." });
      const total = this.montantBudgetOnline(etat?.budget?.totalDisponible ?? etat?.partie?.config?.budgetInitial ?? 0);
      const allocations = {};
      let somme = 0;
      for (const [membreId, valeur] of Object.entries(brut)) {
        const membre = etat.membres?.[membreId];
        if (!this.membreBudgetEligible(membre)) continue;
        const montant = this.montantBudgetOnline(valeur);
        allocations[membreId] = montant;
        somme = this.montantBudgetOnline(somme + montant);
      }
      if (somme > total + 0.005) return this.envoyer(ws, "erreur", { codeErreur: "BUDGET_REPARTITION_DEPASSEMENT", erreur: "La répartition dépasse la trésorerie disponible." });
      etat.budget = {
        mode: "divise",
        totalDisponible: total,
        reserveCommune: this.montantBudgetOnline(total - somme),
        allocations,
        dateModification: Date.now(),
      };
      await this.sauvegarderEtat(etat);
      this.diffuserEtat(etat);
      return;
    }

    if (["lancer_partie", "transferer_admin", "passer_hors_ligne"].includes(action)) {
      return this.envoyer(ws, "erreur", { codeErreur: "ACTION_RETIREE", erreur: "Cette action n'est plus utilisée : la session appartient à son créateur et se ferme lorsqu'il quitte." });
    }

    this.envoyer(ws, "erreur", { erreur: "Action d'administration inconnue." });
  }

  async webSocketClose(ws, code, reason, wasClean) {
    let att;
    try { att = ws.deserializeAttachment(); } catch { return; }
    const etat = await this.chargerEtat();
    if (!etat) return;
    const membre = etat.membres?.[att?.membreId];
    if (!membre) return;

    const encoreConnecte = this.socketsMembre(membre.id, ws).length > 0;
    const retourMenuVolontaire = Number(code) === 4000;
    if (!encoreConnecte && membre.role === "administrateur" && retourMenuVolontaire && !["hors_ligne", "fermee"].includes(etat.partie.statut)) {
      await this.fermerPartie(etat, "administrateur_quitte");
      return;
    }
    if (!encoreConnecte && !["hors_ligne", "fermee"].includes(etat.partie.statut)) {
      if (membre.statut === "accepte") {
        membre.reserveJusquA = retourMenuVolontaire ? null : Date.now() + CLU_ONLINE_GRACE_MS;
        if (membre.role === "administrateur" && !retourMenuVolontaire) {
          this.diffuser("hote_reconnexion", {
            date: Date.now(),
            graceJusquA: membre.reserveJusquA,
          }, (attache) => attache?.membreId !== membre.id);
        }
      } else if (membre.statut === "en_attente") {
        membre.demandeExpireA = Date.now() + (retourMenuVolontaire ? 1_000 : CLU_ONLINE_PENDING_RECONNECT_MS);
      }
      await this.sauvegarderEtat(etat);
      await this.programmerAlarme(etat);
    }
    await this.mettreAJourIndex(etat);
    this.diffuser("presence", {
      membre: this.serialiserMembre(membre, membre.role === "administrateur"),
      evenement: "deconnexion",
      graceJusquA: membre.reserveJusquA || null,
      joueursConnectes: this.idsMembresConnectes().size,
    });
    this.diffuserEtat(etat);
  }

  async webSocketError(ws) {
    try { ws.close(1011, "Erreur WebSocket"); } catch {}
  }

  async alarm() {
    const etat = await this.chargerEtat();
    if (!etat) return;
    if (!(await this.verifierPremiumAdministrateur(etat, true))) return;
    await this.nettoyerReservations(etat);
    const admin = Object.values(etat.membres || {}).find(m => m.role === "administrateur" && m.statut === "accepte");
    if (admin && !this.socketsMembre(admin.id).length && !(Number(admin.reserveJusquA) > Date.now())) {
      await this.fermerPartie(etat, "administrateur_absent");
      return;
    }
    await this.mettreAJourIndex(etat);
    await this.programmerAlarme(etat);
    this.diffuserEtat(etat);
  }
}


async function router(request, env) {
  const url = new URL(request.url);
  const chemin = normaliserChemin(url.pathname);
  const methode = request.method.toUpperCase();

  if (chemin === "/" && methode === "GET") {
    return reponseJson({ ok: true, service: "API CLU", etat: "en ligne", version: "0.26.0", protocoleOnline: CLU_ONLINE_PROTOCOL_VERSION });
  }
  if (chemin.startsWith("/api/en-ligne/")) {
    const incompatibilite = verifierProtocoleOnline(request);
    if (incompatibilite) return incompatibilite;
  }
  if (chemin === "/api/en-ligne/creer" && methode === "POST") return await creerPartieEnLigne(request, env);
  if (chemin === "/api/en-ligne/rejoindre" && methode === "POST") return await rejoindrePartieEnLigne(request, env);
  if (chemin === "/api/en-ligne/ws-ticket" && methode === "POST") return await creerTicketWebSocketPartieEnLigne(request, env);
  if (chemin === "/api/en-ligne/initialiser-jeu" && methode === "POST") return await initialiserJeuPartieEnLigne(request, env);
  if (chemin === "/api/en-ligne/snapshot-jeu" && methode === "POST") return await remplacerSnapshotJeuPartieEnLigne(request, env);
  if (chemin === "/api/en-ligne/quitter" && methode === "POST") return await quitterPartieEnLigne(request, env);
  if (chemin === "/api/en-ligne/parties-ouvertes" && methode === "GET") return await listerPartiesOuvertesEnLigne(request, env);
  if (chemin === "/api/en-ligne/partie" && methode === "GET") return await infosPartieEnLigne(request, env);
  if (chemin === "/api/en-ligne/ws" && methode === "GET") return await websocketPartieEnLigne(request, env);
  if (chemin === "/api/inscription" && methode === "POST") return await inscription(request, env);
  if (chemin === "/api/connexion" && methode === "POST") return await connexion(request, env);
  if (chemin === "/api/google/connexion" && methode === "POST") return await connexionGoogle(request, env);
  if (chemin === "/api/google/inscription" && methode === "POST") return await inscriptionGoogle(request, env);
  if (chemin === "/api/google/lier" && methode === "POST") return await lierGoogle(request, env);
  if (chemin === "/api/conditions-compte" && methode === "POST") return await accepterConditionsCompte(request, env);
  if (chemin === "/api/pseudo" && methode === "POST") return await changerPseudo(request, env);
  if (chemin === "/api/donnees-personnelles" && methode === "GET") return await exporterDonneesPersonnelles(request, env);
  if (chemin === "/api/premium/checkout" && methode === "POST") return await creerCheckoutPremium(request, env);
  if (chemin === "/api/stripe/webhook" && methode === "POST") return await webhookStripe(request, env);
  if (chemin === "/api/moi" && methode === "GET") return await moi(request, env);
  if (chemin === "/api/deconnexion" && methode === "POST") return await deconnexion(request, env);
  if (chemin === "/api/recuperation" && methode === "POST") return await recuperationCompte(request, env);
  if (chemin === "/api/mot-de-passe" && methode === "POST") return await changerMotDePasse(request, env);
  if (chemin === "/api/suppression-compte" && methode === "POST") return await supprimerCompte(request, env);

  return reponseJson({
    ok: false,
    erreur: "Route introuvable.",
    cheminRecu: chemin,
    methodeRecue: methode,
  }, 404);
}

export default {

  async fetch(request, env) {

    try {

      const url =

        new URL(request.url);



      const chemin =

        normaliserChemin(

          url.pathname

        );



      const methode =

        request.method

          .toUpperCase();



      /**

       * Préflight CORS du navigateur.

       */

      if (

        methode === "OPTIONS"

      ) {

        return reponsePreflight(

          request

        );

      }



      /**

      * Les routes API ne peuvent pas

      * être appelées par une page Web

      * provenant d'un autre domaine.

      *

      * Les clients sans Origin

      * (PowerShell, curl, app native)

      * continuent de fonctionner.

       */

      const websocketOnlineDeveloppement =
        chemin === "/api/en-ligne/ws"
        && methode === "GET"
        && request.headers.get("Upgrade")?.toLowerCase() === "websocket"
        && origineWebSocketDeveloppementAutorisee(request);

      if (

        chemin.startsWith(

          "/api/"

        )

      ) {

        if (

          !origineAutorisee(

            request

          )
          && !websocketOnlineDeveloppement

        ) {

          return reponseJson(

            {

              ok: false,

              erreur:

                "Origine non autorisée.",

            },

            403

          );

        }



        /**

        * Protection complémentaire

        * pour les navigateurs modernes.

         */

        if (

          estRequeteNavigateurCrossSite(

            request

          )
          && !websocketOnlineDeveloppement

        ) {

          return reponseJson(

            {

              ok: false,

              erreur:

                "Requête cross-site refusée.",

            },

            403

          );

        }

      }



      const response =

        await router(

          request,

          env

        );



      if (response.status === 101) {
        return response;
      }

      return ajouterCors(

        request,

        response

      );

    } catch (erreur) {

      console.error(

        "Erreur Worker non gérée :",

        erreur

      );



      return ajouterCors(
        request,
        reponseJson(
          {
            ok: false,
            erreur: "Une erreur interne est survenue.",
          },
          500
        )
      );

    }

  },

};