import type { GameTerritory } from '../../types/game'
import type { RegionalGenerationProfile, RegionalTerritoryRuntime } from './regionalCore'
import { generateRegionalTerritory } from './regionalCore'

const fallbackProfiles: Partial<Record<GameTerritory, RegionalGenerationProfile>> = {
  LONDON: {
    id: 'LONDON', label: 'Londres', seed: 'CLU-V32-LONDON', preferredLocale: 'en',
    bounds: { west: -0.72, south: 51.20, east: 0.42, north: 51.82 },
    initialCenter: { longitude: -0.10, latitude: 51.50 }, initialZoom: 7.45,
    areaKm2: 8_400, targetPopulation: 9_850_000, municipalityCount: 150, departmentCount: 7, urbanCenterCount: 18,
    structure: 'MONOCENTRIC', density: 'HIGH', water: 'STANDARD',
    departmentNames: ['Central London', 'North London', 'East London', 'South London', 'West London', 'Thames Valley', 'Outer London'],
    placeAnchors: [
      { name: 'London', longitude: -0.1276, latitude: 51.5072, weight: 1.6 },
      { name: 'Croydon', longitude: -0.1004, latitude: 51.3762, weight: .85 },
      { name: 'Romford', longitude: 0.1837, latitude: 51.5761, weight: .72 },
      { name: 'Enfield', longitude: -0.0814, latitude: 51.6523, weight: .66 },
      { name: 'Kingston', longitude: -0.3007, latitude: 51.4123, weight: .68 },
      { name: 'Harrow', longitude: -0.3346, latitude: 51.5806, weight: .62 },
      { name: 'Bromley', longitude: 0.0148, latitude: 51.4060, weight: .63 },
      { name: 'Uxbridge', longitude: -0.4786, latitude: 51.5460, weight: .58 },
      { name: 'Watford', longitude: -0.3960, latitude: 51.6565, weight: .55 },
      { name: 'Dartford', longitude: 0.2196, latitude: 51.4462, weight: .50 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée du Grand Londres',
  },
  BERLIN: {
    id: 'BERLIN', label: 'Berlin', seed: 'CLU-V32-BERLIN', preferredLocale: 'de',
    bounds: { west: 12.72, south: 52.12, east: 14.02, north: 52.82 },
    initialCenter: { longitude: 13.405, latitude: 52.52 }, initialZoom: 7.35,
    areaKm2: 9_100, targetPopulation: 5_100_000, municipalityCount: 130, departmentCount: 7, urbanCenterCount: 16,
    structure: 'POLYCENTRIC', density: 'STANDARD', water: 'STANDARD',
    departmentNames: ['Berlin Zentrum', 'Nordraum', 'Oderland', 'Südost', 'Potsdamer Raum', 'Havelland', 'Nordost'],
    placeAnchors: [
      { name: 'Berlin', longitude: 13.405, latitude: 52.52, weight: 1.5 },
      { name: 'Potsdam', longitude: 13.0645, latitude: 52.3906, weight: .85 },
      { name: 'Oranienburg', longitude: 13.241, latitude: 52.753, weight: .55 },
      { name: 'Bernau', longitude: 13.587, latitude: 52.679, weight: .55 },
      { name: 'Königs Wusterhausen', longitude: 13.626, latitude: 52.296, weight: .56 },
      { name: 'Falkensee', longitude: 13.091, latitude: 52.56, weight: .50 },
      { name: 'Teltow', longitude: 13.268, latitude: 52.402, weight: .50 },
      { name: 'Erkner', longitude: 13.752, latitude: 52.42, weight: .46 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de Berlin-Brandenburg',
  },
  RANDSTAD: {
    id: 'RANDSTAD', label: 'Randstad', seed: 'CLU-V32-RANDSTAD', preferredLocale: 'nl',
    bounds: { west: 3.85, south: 51.65, east: 5.72, north: 52.70 },
    initialCenter: { longitude: 4.80, latitude: 52.15 }, initialZoom: 6.95,
    areaKm2: 11_500, targetPopulation: 8_600_000, municipalityCount: 165, departmentCount: 7, urbanCenterCount: 20,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'HIGH',
    departmentNames: ['Amsterdamse Regio', 'Rotterdam-Rijnmond', 'Haaglanden', 'Utrecht', 'Holland Rijnland', 'Flevoland', 'Groene Hart'],
    placeAnchors: [
      { name: 'Amsterdam', longitude: 4.9041, latitude: 52.3676, weight: 1.2 },
      { name: 'Rotterdam', longitude: 4.4777, latitude: 51.9244, weight: 1.15 },
      { name: 'Den Haag', longitude: 4.3007, latitude: 52.0705, weight: 1.0 },
      { name: 'Utrecht', longitude: 5.1214, latitude: 52.0907, weight: 1.0 },
      { name: 'Haarlem', longitude: 4.6462, latitude: 52.3874, weight: .65 },
      { name: 'Leiden', longitude: 4.4970, latitude: 52.1601, weight: .62 },
      { name: 'Delft', longitude: 4.3571, latitude: 52.0116, weight: .58 },
      { name: 'Almere', longitude: 5.2647, latitude: 52.3508, weight: .66 },
      { name: 'Dordrecht', longitude: 4.6901, latitude: 51.8133, weight: .58 },
      { name: 'Gouda', longitude: 4.7105, latitude: 52.0115, weight: .52 },
      { name: 'Hilversum', longitude: 5.1764, latitude: 52.2292, weight: .50 },
      { name: 'Zoetermeer', longitude: 4.4931, latitude: 52.0607, weight: .52 },
      { name: 'Amersfoort', longitude: 5.3878, latitude: 52.1561, weight: .58 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de la Randstad',
  },
  BRUSSELS: {
    id: 'BRUSSELS', label: 'Bruxelles', seed: 'CLU-V32-BRUSSELS', preferredLocale: 'fr',
    bounds: { west: 3.88, south: 50.55, east: 4.92, north: 51.15 },
    initialCenter: { longitude: 4.3525, latitude: 50.8503 }, initialZoom: 7.55,
    areaKm2: 6_300, targetPopulation: 3_050_000, municipalityCount: 105, departmentCount: 6, urbanCenterCount: 13,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'LOW',
    departmentNames: ['Bruxelles-Capitale', 'Brabant Nord', 'Brabant Est', 'Brabant Sud', 'Brabant Ouest', 'Dyle-Senne'],
    placeAnchors: [
      { name: 'Bruxelles', longitude: 4.3525, latitude: 50.8503, weight: 1.4 },
      { name: 'Schaerbeek', longitude: 4.3772, latitude: 50.8676, weight: .72 },
      { name: 'Anderlecht', longitude: 4.3082, latitude: 50.8367, weight: .70 },
      { name: 'Uccle', longitude: 4.3372, latitude: 50.8011, weight: .64 },
      { name: 'Vilvorde', longitude: 4.4293, latitude: 50.9280, weight: .55 },
      { name: 'Louvain', longitude: 4.7005, latitude: 50.8798, weight: .66 },
      { name: 'Waterloo', longitude: 4.3978, latitude: 50.7147, weight: .52 },
      { name: 'Hal', longitude: 4.2375, latitude: 50.7338, weight: .50 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de Bruxelles et du Brabant',
  },
  MADRID: {
    id: 'MADRID', label: 'Madrid', seed: 'CLU-V32-MADRID', preferredLocale: 'es',
    bounds: { west: -4.28, south: 39.90, east: -3.02, north: 41.08 },
    initialCenter: { longitude: -3.7038, latitude: 40.4168 }, initialZoom: 6.95,
    areaKm2: 12_800, targetPopulation: 7_000_000, municipalityCount: 145, departmentCount: 7, urbanCenterCount: 17,
    structure: 'MONOCENTRIC', density: 'STANDARD', water: 'LOW',
    departmentNames: ['Madrid Centro', 'Corredor del Henares', 'Norte', 'Sur Metropolitano', 'Oeste', 'Sierra', 'Sureste'],
    placeAnchors: [
      { name: 'Madrid', longitude: -3.7038, latitude: 40.4168, weight: 1.6 },
      { name: 'Alcalá de Henares', longitude: -3.3649, latitude: 40.4819, weight: .72 },
      { name: 'Móstoles', longitude: -3.8649, latitude: 40.3223, weight: .72 },
      { name: 'Leganés', longitude: -3.7635, latitude: 40.3272, weight: .66 },
      { name: 'Getafe', longitude: -3.7327, latitude: 40.3083, weight: .66 },
      { name: 'Fuenlabrada', longitude: -3.7940, latitude: 40.2842, weight: .62 },
      { name: 'Alcobendas', longitude: -3.6324, latitude: 40.5475, weight: .58 },
      { name: 'Torrejón de Ardoz', longitude: -3.4755, latitude: 40.4554, weight: .58 },
      { name: 'Parla', longitude: -3.7676, latitude: 40.2370, weight: .54 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de la Comunidad de Madrid',
  },
  MILAN: {
    id: 'MILAN', label: 'Milan', seed: 'CLU-V32-MILAN', preferredLocale: 'it',
    bounds: { west: 8.40, south: 45.05, east: 9.88, north: 46.03 },
    initialCenter: { longitude: 9.19, latitude: 45.464 }, initialZoom: 7.05,
    areaKm2: 10_900, targetPopulation: 5_400_000, municipalityCount: 145, departmentCount: 7, urbanCenterCount: 17,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'LOW',
    departmentNames: ['Milano', 'Monza-Brianza', 'Nord Ovest', 'Nord Est', 'Sud Milano', 'Lodigiano', 'Ticino-Adda'],
    placeAnchors: [
      { name: 'Milano', longitude: 9.19, latitude: 45.464, weight: 1.5 },
      { name: 'Monza', longitude: 9.2744, latitude: 45.5845, weight: .78 },
      { name: 'Sesto San Giovanni', longitude: 9.2370, latitude: 45.5345, weight: .66 },
      { name: 'Rho', longitude: 9.0402, latitude: 45.5325, weight: .58 },
      { name: 'Legnano', longitude: 8.9151, latitude: 45.5979, weight: .54 },
      { name: 'Pavia', longitude: 9.1582, latitude: 45.1847, weight: .62 },
      { name: 'Lodi', longitude: 9.5037, latitude: 45.3140, weight: .54 },
      { name: 'Treviglio', longitude: 9.5890, latitude: 45.5208, weight: .48 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de l’aire milanaise',
  },
  WARSAW: {
    id: 'WARSAW', label: 'Varsovie', seed: 'CLU-V32-WARSAW', preferredLocale: 'pl',
    bounds: { west: 20.30, south: 51.78, east: 21.72, north: 52.72 },
    initialCenter: { longitude: 21.0122, latitude: 52.2297 }, initialZoom: 7.05,
    areaKm2: 11_700, targetPopulation: 3_300_000, municipalityCount: 130, departmentCount: 6, urbanCenterCount: 15,
    structure: 'MONOCENTRIC', density: 'STANDARD', water: 'STANDARD',
    departmentNames: ['Warszawa', 'Północ', 'Wschód', 'Południe', 'Zachód', 'Dolina Wisły'],
    placeAnchors: [
      { name: 'Warszawa', longitude: 21.0122, latitude: 52.2297, weight: 1.55 },
      { name: 'Pruszków', longitude: 20.8123, latitude: 52.1707, weight: .58 },
      { name: 'Piaseczno', longitude: 21.0238, latitude: 52.0814, weight: .58 },
      { name: 'Legionowo', longitude: 20.9266, latitude: 52.4015, weight: .54 },
      { name: 'Otwock', longitude: 21.2613, latitude: 52.1058, weight: .52 },
      { name: 'Wołomin', longitude: 21.2400, latitude: 52.3400, weight: .50 },
      { name: 'Marki', longitude: 21.1047, latitude: 52.3207, weight: .50 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de l’aire de Varsovie',
  },
  LISBON: {
    id: 'LISBON', label: 'Lisbonne', seed: 'CLU-V32-LISBON', preferredLocale: 'pt',
    bounds: { west: -9.78, south: 38.40, east: -8.62, north: 39.18 },
    initialCenter: { longitude: -9.1393, latitude: 38.7223 }, initialZoom: 7.25,
    areaKm2: 9_500, targetPopulation: 3_100_000, municipalityCount: 120, departmentCount: 6, urbanCenterCount: 14,
    structure: 'POLYCENTRIC', density: 'STANDARD', water: 'HIGH',
    departmentNames: ['Lisboa', 'Sintra-Cascais', 'Margem Sul', 'Loures', 'Tejo Interior', 'Arrábida'],
    placeAnchors: [
      { name: 'Lisboa', longitude: -9.1393, latitude: 38.7223, weight: 1.4 },
      { name: 'Sintra', longitude: -9.3817, latitude: 38.8029, weight: .72 },
      { name: 'Cascais', longitude: -9.4215, latitude: 38.6979, weight: .68 },
      { name: 'Amadora', longitude: -9.2308, latitude: 38.7538, weight: .68 },
      { name: 'Oeiras', longitude: -9.3124, latitude: 38.6972, weight: .62 },
      { name: 'Loures', longitude: -9.1685, latitude: 38.8309, weight: .58 },
      { name: 'Almada', longitude: -9.1569, latitude: 38.6765, weight: .68 },
      { name: 'Setúbal', longitude: -8.8882, latitude: 38.5244, weight: .58 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de la région de Lisbonne',
  },
  PRAGUE: {
    id: 'PRAGUE', label: 'Prague', seed: 'CLU-V32-PRAGUE', preferredLocale: 'cs',
    bounds: { west: 13.72, south: 49.72, east: 15.02, north: 50.48 },
    initialCenter: { longitude: 14.4378, latitude: 50.0755 }, initialZoom: 7.25,
    areaKm2: 8_800, targetPopulation: 2_150_000, municipalityCount: 115, departmentCount: 6, urbanCenterCount: 13,
    structure: 'MONOCENTRIC', density: 'STANDARD', water: 'STANDARD',
    departmentNames: ['Praha', 'Sever', 'Východ', 'Jih', 'Západ', 'Vltava'],
    placeAnchors: [
      { name: 'Praha', longitude: 14.4378, latitude: 50.0755, weight: 1.55 },
      { name: 'Kladno', longitude: 14.1029, latitude: 50.1473, weight: .62 },
      { name: 'Beroun', longitude: 14.0720, latitude: 49.9638, weight: .48 },
      { name: 'Říčany', longitude: 14.6543, latitude: 49.9917, weight: .50 },
      { name: 'Kralupy nad Vltavou', longitude: 14.3115, latitude: 50.2411, weight: .48 },
      { name: 'Brandýs nad Labem', longitude: 14.6684, latitude: 50.1871, weight: .48 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de Prague et de la Bohême centrale',
  },
  BERN: {
    id: 'BERN', label: 'Berne', seed: 'CLU-V32-BERN', preferredLocale: 'de',
    bounds: { west: 6.62, south: 46.45, east: 8.28, north: 47.48 },
    initialCenter: { longitude: 7.4474, latitude: 46.9480 }, initialZoom: 7.0,
    areaKm2: 10_600, targetPopulation: 1_650_000, municipalityCount: 115, departmentCount: 7, urbanCenterCount: 14,
    structure: 'POLYCENTRIC', density: 'LOW', water: 'HIGH',
    departmentNames: ['Bern-Mittelland', 'Seeland', 'Oberaargau', 'Emmental', 'Thun', 'Freiburger Raum', 'Jura-Südfuss'],
    placeAnchors: [
      { name: 'Bern', longitude: 7.4474, latitude: 46.9480, weight: 1.2 },
      { name: 'Köniz', longitude: 7.4140, latitude: 46.9240, weight: .62 },
      { name: 'Thun', longitude: 7.6280, latitude: 46.7580, weight: .72 },
      { name: 'Biel/Bienne', longitude: 7.2471, latitude: 47.1368, weight: .70 },
      { name: 'Burgdorf', longitude: 7.6270, latitude: 47.0559, weight: .52 },
      { name: 'Fribourg', longitude: 7.1513, latitude: 46.8065, weight: .58 },
      { name: 'Solothurn', longitude: 7.5375, latitude: 47.2088, weight: .54 },
    ],
    attribution: 'Carte régionale locale CLU · géographie de jeu inspirée de la région bernoise',
  },
  NEW_YORK: {
    id: 'NEW_YORK', label: 'New York', seed: 'CLU-V40-NYC', preferredLocale: 'en',
    bounds: { west: -74.65, south: 40.25, east: -73.30, north: 41.15 }, initialCenter: { longitude: -74.0060, latitude: 40.7128 }, initialZoom: 7.0,
    areaKm2: 17_500, targetPopulation: 20_500_000, municipalityCount: 180, departmentCount: 8, urbanCenterCount: 22,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'HIGH', departmentNames: ['New York City', 'Long Island', 'North Jersey', 'Lower Hudson', 'Connecticut West', 'Harbor', 'Outer Metro', 'Regional Core'],
    placeAnchors: [{ name: 'Manhattan', longitude: -73.9857, latitude: 40.7484, weight: 1.6 }, { name: 'Brooklyn', longitude: -73.9442, latitude: 40.6782, weight: 1.15 }, { name: 'Queens', longitude: -73.7949, latitude: 40.7282, weight: 1.0 }, { name: 'Newark', longitude: -74.1724, latitude: 40.7357, weight: .85 }, { name: 'Jersey City', longitude: -74.0435, latitude: 40.7178, weight: .75 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  OTTAWA: {
    id: 'OTTAWA', label: 'Ottawa', seed: 'CLU-V40-OTTAWA', preferredLocale: 'en',
    bounds: { west: -76.35, south: 44.85, east: -74.95, north: 45.85 }, initialCenter: { longitude: -75.6972, latitude: 45.4215 }, initialZoom: 7.0,
    areaKm2: 8_500, targetPopulation: 1_650_000, municipalityCount: 95, departmentCount: 6, urbanCenterCount: 12,
    structure: 'POLYCENTRIC', density: 'STANDARD', water: 'HIGH', departmentNames: ['Ottawa Centre', 'Gatineau', 'West Ottawa', 'East Ottawa', 'South Capital', 'Outaouais'],
    placeAnchors: [{ name: 'Ottawa', longitude: -75.6972, latitude: 45.4215, weight: 1.35 }, { name: 'Gatineau', longitude: -75.7013, latitude: 45.4765, weight: .9 }, { name: 'Kanata', longitude: -75.9000, latitude: 45.3088, weight: .62 }, { name: 'Orleans', longitude: -75.4553, latitude: 45.4558, weight: .58 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  TOKYO: {
    id: 'TOKYO', label: 'Tokyo', seed: 'CLU-V40-TOKYO', preferredLocale: 'ja',
    bounds: { west: 138.80, south: 35.25, east: 140.45, north: 36.20 }, initialCenter: { longitude: 139.6917, latitude: 35.6895 }, initialZoom: 6.85,
    areaKm2: 18_500, targetPopulation: 37_000_000, municipalityCount: 220, departmentCount: 9, urbanCenterCount: 26,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'HIGH', departmentNames: ['Tokyo Core', 'West Tokyo', 'Yokohama', 'Kawasaki', 'Saitama', 'Chiba', 'Bay East', 'Tama', 'Outer Metro'],
    placeAnchors: [{ name: 'Tokyo', longitude: 139.6917, latitude: 35.6895, weight: 1.6 }, { name: 'Yokohama', longitude: 139.6380, latitude: 35.4437, weight: 1.25 }, { name: 'Saitama', longitude: 139.6489, latitude: 35.8617, weight: .9 }, { name: 'Chiba', longitude: 140.1063, latitude: 35.6074, weight: .85 }, { name: 'Kawasaki', longitude: 139.7029, latitude: 35.5308, weight: .85 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  VIENNA: {
    id: 'VIENNA', label: 'Vienne', seed: 'CLU-V40-VIENNA', preferredLocale: 'de',
    bounds: { west: 15.65, south: 47.75, east: 16.95, north: 48.65 }, initialCenter: { longitude: 16.3738, latitude: 48.2082 }, initialZoom: 7.1,
    areaKm2: 8_000, targetPopulation: 3_100_000, municipalityCount: 105, departmentCount: 6, urbanCenterCount: 13,
    structure: 'MONOCENTRIC', density: 'HIGH', water: 'STANDARD', departmentNames: ['Wien', 'Nordost', 'Sued', 'West', 'Donau', 'Umland'],
    placeAnchors: [{ name: 'Wien', longitude: 16.3738, latitude: 48.2082, weight: 1.5 }, { name: 'Schwechat', longitude: 16.4667, latitude: 48.1333, weight: .55 }, { name: 'Klosterneuburg', longitude: 16.3250, latitude: 48.3052, weight: .52 }, { name: 'Baden', longitude: 16.2308, latitude: 48.0054, weight: .55 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  COPENHAGEN: {
    id: 'COPENHAGEN', label: 'Copenhague', seed: 'CLU-V40-COPENHAGEN', preferredLocale: 'en',
    bounds: { west: 11.55, south: 55.35, east: 13.05, north: 56.15 }, initialCenter: { longitude: 12.5683, latitude: 55.6761 }, initialZoom: 7.1,
    areaKm2: 7_500, targetPopulation: 2_350_000, municipalityCount: 100, departmentCount: 6, urbanCenterCount: 13,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'HIGH', departmentNames: ['Copenhagen', 'North Zealand', 'West', 'South', 'Oresund', 'Malmo Corridor'],
    placeAnchors: [{ name: 'Copenhagen', longitude: 12.5683, latitude: 55.6761, weight: 1.45 }, { name: 'Frederiksberg', longitude: 12.5320, latitude: 55.6780, weight: .72 }, { name: 'Roskilde', longitude: 12.0803, latitude: 55.6415, weight: .62 }, { name: 'Malmo', longitude: 13.0038, latitude: 55.6050, weight: .75 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  STOCKHOLM: {
    id: 'STOCKHOLM', label: 'Stockholm', seed: 'CLU-V40-STOCKHOLM', preferredLocale: 'en',
    bounds: { west: 17.25, south: 59.00, east: 19.05, north: 59.75 }, initialCenter: { longitude: 18.0686, latitude: 59.3293 }, initialZoom: 7.0,
    areaKm2: 9_000, targetPopulation: 2_450_000, municipalityCount: 105, departmentCount: 6, urbanCenterCount: 14,
    structure: 'POLYCENTRIC', density: 'STANDARD', water: 'HIGH', departmentNames: ['Stockholm Core', 'North', 'South', 'West', 'Archipelago', 'Outer County'],
    placeAnchors: [{ name: 'Stockholm', longitude: 18.0686, latitude: 59.3293, weight: 1.45 }, { name: 'Solna', longitude: 18.0009, latitude: 59.3600, weight: .68 }, { name: 'Sodertalje', longitude: 17.6253, latitude: 59.1955, weight: .62 }, { name: 'Nacka', longitude: 18.1637, latitude: 59.3107, weight: .58 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  OSLO: {
    id: 'OSLO', label: 'Oslo', seed: 'CLU-V40-OSLO', preferredLocale: 'en',
    bounds: { west: 10.05, south: 59.55, east: 11.35, north: 60.25 }, initialCenter: { longitude: 10.7522, latitude: 59.9139 }, initialZoom: 7.1,
    areaKm2: 7_800, targetPopulation: 1_600_000, municipalityCount: 90, departmentCount: 6, urbanCenterCount: 12,
    structure: 'MONOCENTRIC', density: 'STANDARD', water: 'HIGH', departmentNames: ['Oslo', 'Asker', 'Baerum', 'North', 'East', 'Oslofjord'],
    placeAnchors: [{ name: 'Oslo', longitude: 10.7522, latitude: 59.9139, weight: 1.45 }, { name: 'Drammen', longitude: 10.2045, latitude: 59.7441, weight: .68 }, { name: 'Lillestrom', longitude: 11.0492, latitude: 59.9560, weight: .58 }, { name: 'Sandvika', longitude: 10.5277, latitude: 59.8907, weight: .56 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  HELSINKI: {
    id: 'HELSINKI', label: 'Helsinki', seed: 'CLU-V40-HELSINKI', preferredLocale: 'en',
    bounds: { west: 24.20, south: 59.85, east: 25.65, north: 60.55 }, initialCenter: { longitude: 24.9384, latitude: 60.1699 }, initialZoom: 7.05,
    areaKm2: 7_700, targetPopulation: 1_650_000, municipalityCount: 95, departmentCount: 6, urbanCenterCount: 13,
    structure: 'POLYCENTRIC', density: 'STANDARD', water: 'HIGH', departmentNames: ['Helsinki', 'Espoo', 'Vantaa', 'East', 'West', 'Coast'],
    placeAnchors: [{ name: 'Helsinki', longitude: 24.9384, latitude: 60.1699, weight: 1.4 }, { name: 'Espoo', longitude: 24.6559, latitude: 60.2055, weight: .82 }, { name: 'Vantaa', longitude: 25.0378, latitude: 60.2934, weight: .78 }, { name: 'Kerava', longitude: 25.1050, latitude: 60.4034, weight: .50 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  ATHENS: {
    id: 'ATHENS', label: 'Athenes', seed: 'CLU-V40-ATHENS', preferredLocale: 'en',
    bounds: { west: 22.70, south: 37.55, east: 24.35, north: 38.45 }, initialCenter: { longitude: 23.7275, latitude: 37.9838 }, initialZoom: 7.0,
    areaKm2: 8_600, targetPopulation: 4_000_000, municipalityCount: 115, departmentCount: 6, urbanCenterCount: 15,
    structure: 'MONOCENTRIC', density: 'HIGH', water: 'HIGH', departmentNames: ['Athens', 'Piraeus', 'North Attica', 'East Attica', 'West Attica', 'South Coast'],
    placeAnchors: [{ name: 'Athens', longitude: 23.7275, latitude: 37.9838, weight: 1.5 }, { name: 'Piraeus', longitude: 23.6465, latitude: 37.9420, weight: .85 }, { name: 'Marousi', longitude: 23.8060, latitude: 38.0540, weight: .62 }, { name: 'Elefsina', longitude: 23.5429, latitude: 38.0416, weight: .50 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  BUDAPEST: {
    id: 'BUDAPEST', label: 'Budapest', seed: 'CLU-V40-BUDAPEST', preferredLocale: 'en',
    bounds: { west: 18.20, south: 47.15, east: 19.80, north: 47.85 }, initialCenter: { longitude: 19.0402, latitude: 47.4979 }, initialZoom: 7.1,
    areaKm2: 8_200, targetPopulation: 3_000_000, municipalityCount: 105, departmentCount: 6, urbanCenterCount: 13,
    structure: 'MONOCENTRIC', density: 'HIGH', water: 'STANDARD', departmentNames: ['Budapest Core', 'Buda Hills', 'Pest East', 'North', 'South', 'Danube Corridor'],
    placeAnchors: [{ name: 'Budapest', longitude: 19.0402, latitude: 47.4979, weight: 1.5 }, { name: 'Budaors', longitude: 18.9585, latitude: 47.4618, weight: .55 }, { name: 'Szentendre', longitude: 19.0756, latitude: 47.6694, weight: .52 }, { name: 'Godollo', longitude: 19.3550, latitude: 47.6008, weight: .52 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  ISTANBUL: {
    id: 'ISTANBUL', label: 'Istanbul', seed: 'CLU-V40-ISTANBUL', preferredLocale: 'en',
    bounds: { west: 28.20, south: 40.60, east: 30.25, north: 41.55 }, initialCenter: { longitude: 28.9784, latitude: 41.0082 }, initialZoom: 6.75,
    areaKm2: 15_500, targetPopulation: 16_000_000, municipalityCount: 180, departmentCount: 8, urbanCenterCount: 22,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'HIGH', departmentNames: ['European Core', 'Asian Core', 'Bosphorus', 'West', 'East', 'North', 'Marmara', 'Outer Metro'],
    placeAnchors: [{ name: 'Istanbul', longitude: 28.9784, latitude: 41.0082, weight: 1.55 }, { name: 'Kadikoy', longitude: 29.0275, latitude: 40.9910, weight: .95 }, { name: 'Uskudar', longitude: 29.0153, latitude: 41.0257, weight: .82 }, { name: 'Bakirkoy', longitude: 28.8772, latitude: 40.9800, weight: .75 }, { name: 'Pendik', longitude: 29.2333, latitude: 40.8775, weight: .68 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  SAO_PAULO: {
    id: 'SAO_PAULO', label: 'Sao Paulo', seed: 'CLU-V40-SAO', preferredLocale: 'pt',
    bounds: { west: -47.35, south: -24.25, east: -45.75, north: -23.15 }, initialCenter: { longitude: -46.6333, latitude: -23.5505 }, initialZoom: 6.75,
    areaKm2: 16_500, targetPopulation: 22_000_000, municipalityCount: 190, departmentCount: 8, urbanCenterCount: 24,
    structure: 'POLYCENTRIC', density: 'HIGH', water: 'STANDARD', departmentNames: ['Sao Paulo Core', 'ABC', 'Guarulhos', 'Osasco', 'West', 'North', 'South', 'Outer Metro'],
    placeAnchors: [{ name: 'Sao Paulo', longitude: -46.6333, latitude: -23.5505, weight: 1.6 }, { name: 'Guarulhos', longitude: -46.5333, latitude: -23.4543, weight: .9 }, { name: 'Osasco', longitude: -46.7917, latitude: -23.5325, weight: .78 }, { name: 'Santo Andre', longitude: -46.5333, latitude: -23.6639, weight: .75 }, { name: 'Sao Bernardo', longitude: -46.5646, latitude: -23.6914, weight: .72 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },
  SYDNEY: {
    id: 'SYDNEY', label: 'Sydney', seed: 'CLU-V40-SYDNEY', preferredLocale: 'en',
    bounds: { west: 150.25, south: -34.25, east: 151.75, north: -33.45 }, initialCenter: { longitude: 151.2093, latitude: -33.8688 }, initialZoom: 6.85,
    areaKm2: 13_500, targetPopulation: 5_600_000, municipalityCount: 150, departmentCount: 7, urbanCenterCount: 18,
    structure: 'POLYCENTRIC', density: 'STANDARD', water: 'HIGH', departmentNames: ['Sydney Core', 'Parramatta', 'North Shore', 'West', 'South', 'Harbour', 'Outer Metro'],
    placeAnchors: [{ name: 'Sydney', longitude: 151.2093, latitude: -33.8688, weight: 1.45 }, { name: 'Parramatta', longitude: 151.0034, latitude: -33.8150, weight: .9 }, { name: 'Liverpool', longitude: 150.9250, latitude: -33.9209, weight: .66 }, { name: 'Chatswood', longitude: 151.1800, latitude: -33.7970, weight: .62 }, { name: 'Penrith', longitude: 150.6942, latitude: -33.7507, weight: .60 }],
    attribution: 'Fallback communes CLU - basemap OpenStreetMap separate',
  },

}

const fallbackRuntimeCache = new Map<GameTerritory, RegionalTerritoryRuntime>()

/**
 * Les profils historiques V32 sont conservés uniquement comme filet de sécurité
 * pour les zones de simulation (communes/population) si les GeoJSON administratifs
 * locaux n'ont pas encore été installés. Ils ne servent plus jamais de fond de carte.
 */
export function getRealTerritoryMunicipalityFallback(territory: GameTerritory) {
  const profile = fallbackProfiles[territory]
  if (!profile) return null
  const cached = fallbackRuntimeCache.get(territory)
  if (cached) return cached
  const runtime = generateRegionalTerritory({
    ...profile,
    attribution: 'Zones de simulation CLU de secours — fond cartographique réel séparé',
  })
  fallbackRuntimeCache.set(territory, runtime)
  return runtime
}

export function hasRealTerritoryMunicipalityFallback(territory: GameTerritory) {
  return Boolean(fallbackProfiles[territory])
}

/** @deprecated V40: utiliser getRealTerritoryMunicipalityFallback. */
export function getLocalRegionalTerritoryRuntime(territory: GameTerritory) {
  return getRealTerritoryMunicipalityFallback(territory)
}

/** @deprecated V40: les territoires réels sont désormais définis dans config/realMapSources.ts. */
export function hasLocalRegionalTerritory(territory: GameTerritory) {
  return hasRealTerritoryMunicipalityFallback(territory)
}

export function getLocalRegionalTerritoryProfile(territory: GameTerritory) {
  return fallbackProfiles[territory] ?? null
}
