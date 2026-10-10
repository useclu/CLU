import type { GameStationUrbanContext } from '../types/network'

export interface GameStationNameSuggestionInput {
  cityName?: string | null
  fallbackLocality?: string | null
  context?: GameStationUrbanContext | null
  longitude: number
  latitude: number
  usedNames?: string[]
  page?: number
  /** Langue locale du territoire, utilisée uniquement pour le style des noms générés. */
  locale?: string | null
}

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function cleanPlaceName(value: string | undefined | null) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim()
    .slice(0, 42)
}

const LOCALIZED_GENERIC_SUFFIXES: Record<string, string[]> = {
  fr: ['Centre', 'République', 'Les Terrasses', 'Bellevue', 'Les Ormes', 'Les Jardins', 'Les Coteaux', 'Grand Parc', 'Les Rives', 'Hôtel de Ville', 'La Plaine', 'Les Halles', 'Le Belvédère', 'Les Tilleuls', 'La Prairie', 'Les Quais', 'Les Horizons', 'Les Hauts', 'Le Forum'],
  en: ['Central', 'Civic Centre', 'Market Square', 'Parkside', 'Riverside', 'The Terraces', 'Northgate', 'Southbank', 'Old Town', 'The Meadows', 'Hillview', 'Lakeside', 'Greenfield', 'West End', 'Station Quarter', 'The Gardens'],
  de: ['Zentrum', 'Rathaus', 'Marktplatz', 'Parkviertel', 'Terrassen', 'Am Stadtpark', 'Altstadt', 'Nordtor', 'Südufer', 'Höhen', 'Gartenviertel', 'Westend', 'Promenade', 'Bahnhofsviertel'],
  nl: ['Centrum', 'Stadhuis', 'Markt', 'Parkwijk', 'Terrassen', 'Waterkant', 'Oude Stad', 'Noordpoort', 'Zuidoever', 'Tuinen', 'Hoogte', 'Stationskwartier', 'Promenade'],
  es: ['Centro', 'Ayuntamiento', 'Plaza Mayor', 'Los Jardines', 'Las Terrazas', 'Mirador', 'Mercado', 'Ribera', 'Parque Central', 'Puerta Norte', 'Barrio de la Estación', 'Paseo'],
  it: ['Centro', 'Municipio', 'Piazza Centrale', 'I Giardini', 'Le Terrazze', 'Belvedere', 'Mercato', 'Riva', 'Parco Centrale', 'Porta Nord', 'Quartiere Stazione', 'Passeggiata'],
  pt: ['Centro', 'Câmara Municipal', 'Praça Central', 'Jardins', 'Terraços', 'Miradouro', 'Mercado', 'Ribeira', 'Parque Central', 'Porta Norte', 'Bairro da Estação', 'Passeio'],
  pl: ['Centrum', 'Ratusz', 'Rynek', 'Ogrody', 'Tarasy', 'Wzgórze', 'Nadbrzeże', 'Park Centralny', 'Brama Północna', 'Dzielnica Dworcowa', 'Promenada'],
}

const LOCALIZED_COMBINATIONS: Record<string, { forms: string[]; names: string[] }> = {
  fr: { forms: ['Porte', 'Clos', 'Jardins', 'Coteaux', 'Terrasses', 'Promenade', 'Carrefour', 'Square'], names: ['Tilleuls', 'Ormes', 'Saules', 'Acacias', 'Érables', 'Amandiers', 'Moulins', 'Vignes', 'Sources', 'Horizons', 'Rives', 'Ateliers', 'Pins', 'Quais', 'Prairies'] },
  en: { forms: ['Gate', 'Gardens', 'Heights', 'Terraces', 'Promenade', 'Square', 'Cross', 'Quarter'], names: ['Willows', 'Oaks', 'Maples', 'Mill', 'Vineyard', 'Springs', 'Horizon', 'Riverside', 'Workshop', 'Pines', 'Meadows'] },
  de: { forms: ['Tor', 'Gärten', 'Höhe', 'Terrassen', 'Promenade', 'Platz', 'Viertel'], names: ['Linden', 'Eichen', 'Weiden', 'Mühlen', 'Quellen', 'Ufer', 'Kiefern', 'Wiesen'] },
  nl: { forms: ['Poort', 'Tuinen', 'Hoogte', 'Terrassen', 'Promenade', 'Plein', 'Kwartier'], names: ['Linden', 'Eiken', 'Wilgen', 'Molens', 'Bronnen', 'Oever', 'Dennen', 'Weiden'] },
  es: { forms: ['Puerta', 'Jardines', 'Altos', 'Terrazas', 'Paseo', 'Plaza', 'Barrio'], names: ['Tilos', 'Olmos', 'Sauces', 'Molinos', 'Fuentes', 'Riberas', 'Pinos', 'Praderas'] },
  it: { forms: ['Porta', 'Giardini', 'Collina', 'Terrazze', 'Passeggiata', 'Piazza', 'Quartiere'], names: ['Tigli', 'Olmi', 'Salici', 'Mulini', 'Fonti', 'Rive', 'Pini', 'Prati'] },
  pt: { forms: ['Porta', 'Jardins', 'Altos', 'Terraços', 'Passeio', 'Praça', 'Bairro'], names: ['Tílias', 'Olmos', 'Salgueiros', 'Moinhos', 'Fontes', 'Ribeiras', 'Pinheiros', 'Prados'] },
  pl: { forms: ['Brama', 'Ogrody', 'Wzgórze', 'Tarasy', 'Promenada', 'Plac', 'Dzielnica'], names: ['Lip', 'Dębów', 'Wierzb', 'Młynów', 'Źródeł', 'Nabrzeża', 'Sosen', 'Łąk'] },
}

function localeBase(value: string | null | undefined) {
  const base = String(value ?? '').trim().toLocaleLowerCase().split(/[-_]/)[0] || 'en'
  return LOCALIZED_GENERIC_SUFFIXES[base] ? base : 'en'
}

function plausibleNamedPoi(value: string) {
  // On évite de transformer chaque commerce ou marque en nom de station. Les
  // grands équipements publics restent en revanche de bonnes inspirations.
  return /\b(universit|university|college|campus|h[oô]pital|hospital|clinic|gare|station|bahnhof|stazione|estaci[oó]n|estação|dworzec|stade|stadium|arena|mus[eé]e|museum|museo|teatro|theatre|theater|parc|park|jardin|garden|biblioth|library|biblioteca|centre|center|zentrum|centrum)\b/i.test(value)
}

function suffixPool(context: GameStationUrbanContext | null | undefined, locale?: string | null) {
  const pool = new Set<string>()
  const poiKinds = (context?.poiKinds ?? []).join(' ').toLowerCase()
  const language = localeBase(locale)

  for (const water of context?.waterNames ?? []) {
    const name = cleanPlaceName(water)
    if (!name) continue
    if (language === 'fr') { pool.add(`Rives de ${name}`); pool.add(`Quai de ${name}`) }
    else if (language === 'de') pool.add(`Am ${name}`)
    else if (language === 'nl') pool.add(`${name} Waterkant`)
    else if (language === 'es') pool.add(`Ribera de ${name}`)
    else if (language === 'it') pool.add(`Riva ${name}`)
    else if (language === 'pt') pool.add(`Ribeira de ${name}`)
    else if (language === 'pl') pool.add(`Nad ${name}`)
    else pool.add(`${name} Riverside`)
  }
  for (const park of context?.parkNames ?? []) {
    const name = cleanPlaceName(park)
    if (!name) continue
    if (/^(parc|park|jardin|jardins|garden|gardens|square)\b/i.test(name)) pool.add(name)
    else if (language === 'fr') pool.add(`Parc ${name}`)
    else if (language === 'de') pool.add(`${name} Park`)
    else if (language === 'nl') pool.add(`Park ${name}`)
    else if (language === 'es') pool.add(`Parque ${name}`)
    else if (language === 'it') pool.add(`Parco ${name}`)
    else if (language === 'pt') pool.add(`Parque ${name}`)
    else if (language === 'pl') pool.add(`Park ${name}`)
    else pool.add(`${name} Park`)
  }
  for (const road of context?.roadNames ?? []) {
    const name = cleanPlaceName(road).replace(/^(avenue|boulevard|rue|route|place|street|road|straße|strasse|weg|calle|avenida|via|viale|rua|aleja|ulica)\s+/i, '')
    if (name && name.length >= 3 && name.length <= 34) pool.add(name)
  }
  for (const poi of context?.poiNames ?? []) {
    const name = cleanPlaceName(poi)
    if (name && name.length <= 34 && plausibleNamedPoi(name)) pool.add(name)
  }

  const addKind = (...values: string[]) => values.forEach(value => pool.add(value))
  if (/university|college|school|kindergarten|education/.test(poiKinds)) {
    if (language === 'fr') addKind('Campus', 'Université', 'Les Facultés')
    else if (language === 'de') addKind('Campus', 'Universität', 'Hochschule')
    else if (language === 'nl') addKind('Campus', 'Universiteit', 'Hogeschool')
    else if (language === 'es') addKind('Campus', 'Universidad', 'Facultades')
    else if (language === 'it') addKind('Campus', 'Università', 'Facoltà')
    else if (language === 'pt') addKind('Campus', 'Universidade', 'Faculdades')
    else if (language === 'pl') addKind('Kampus', 'Uniwersytet', 'Uczelnia')
    else addKind('Campus', 'University', 'College Quarter')
  }
  if (/hospital|clinic/.test(poiKinds)) {
    if (language === 'fr') addKind('Hôpital', 'Centre Hospitalier')
    else if (language === 'de') addKind('Klinikum', 'Krankenhaus')
    else if (language === 'nl') addKind('Ziekenhuis', 'Medisch Centrum')
    else if (language === 'es') addKind('Hospital', 'Centro Médico')
    else if (language === 'it') addKind('Ospedale', 'Centro Medico')
    else if (language === 'pt') addKind('Hospital', 'Centro Médico')
    else if (language === 'pl') addKind('Szpital', 'Centrum Medyczne')
    else addKind('Hospital', 'Medical Centre')
  }
  if (/mall|shop|shopping|supermarket|market|commercial/.test(poiKinds)) {
    if (language === 'fr') addKind('Les Arcades', 'Grand Marché', 'Centre Commercial')
    else if (language === 'de') addKind('Markt', 'Arkaden', 'Einkaufszentrum')
    else if (language === 'nl') addKind('Markt', 'Arcade', 'Winkelcentrum')
    else if (language === 'es') addKind('Mercado', 'Las Arcadas', 'Centro Comercial')
    else if (language === 'it') addKind('Mercato', 'Le Arcate', 'Centro Commerciale')
    else if (language === 'pt') addKind('Mercado', 'Arcadas', 'Centro Comercial')
    else if (language === 'pl') addKind('Rynek', 'Arkady', 'Centrum Handlowe')
    else addKind('Market', 'The Arcades', 'Shopping Centre')
  }

  ;(LOCALIZED_GENERIC_SUFFIXES[language] ?? LOCALIZED_GENERIC_SUFFIXES.en!).forEach(item => pool.add(item))
  const combinations = LOCALIZED_COMBINATIONS[language] ?? LOCALIZED_COMBINATIONS.en!
  for (const form of combinations.forms) {
    for (const name of combinations.names) {
      if (language === 'fr') pool.add(`${form} des ${name}`)
      else pool.add(`${form} ${name}`)
    }
  }

  return [...pool]
}

export function buildStationNameSuggestions(input: GameStationNameSuggestionInput) {
  const locality = cleanPlaceName(input.context?.localityName)
    || cleanPlaceName(input.fallbackLocality)
    || cleanPlaceName(input.cityName)
    || 'Métropole'
  const used = new Set((input.usedNames ?? []).map(name => name.trim().toLocaleLowerCase()))
  const page = Math.max(0, Math.floor(input.page ?? 0))
  const pool = suffixPool(input.context, input.locale)
  let state = hashText(`${locality}|${input.longitude.toFixed(5)}|${input.latitude.toFixed(5)}`) || 1
  const shuffled = [...pool]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const swapIndex = state % (index + 1)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!]
  }

  const candidates: string[] = []
  const start = page * 4
  for (let offset = 0; offset < shuffled.length && candidates.length < 4; offset += 1) {
    const suffix = shuffled[(start + offset) % shuffled.length]!
    const value = `${locality} – ${suffix}`.slice(0, 60)
    const key = value.toLocaleLowerCase()
    if (!used.has(key) && !candidates.some(item => item.toLocaleLowerCase() === key)) candidates.push(value)
  }

  if (!candidates.length) candidates.push(`${locality} – Centre`.slice(0, 60))
  return candidates
}
