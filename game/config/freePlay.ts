import { GAME_INITIAL_BUDGET } from './economy'
import type {
  GameCapitalPreset,
  GameEconomyProfile,
  GameEventFrequency,
  GameFreePlaySettings,
  GameGraphicsQuality,
} from '../types/freePlay'

export const GAME_FREE_PLAY_CAPITALS: Record<Exclude<GameCapitalPreset, 'CUSTOM'>, number> = {
  STANDARD: GAME_INITIAL_BUDGET,
  COMFORT: 8_000_000_000,
  RICH: 20_000_000_000,
}

export const GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL = 25_000_000
export const GAME_FREE_PLAY_CUSTOM_MAX_CAPITAL = 999_000_000_000

export const GAME_ECONOMY_PROFILE_MULTIPLIERS: Record<GameEconomyProfile, {
  revenue: number
  operatingCost: number
  credit: number
}> = {
  GENEROUS: { revenue: 1.10, operatingCost: 0.90, credit: 1.20 },
  STANDARD: { revenue: 1, operatingCost: 1, credit: 1 },
  HARD: { revenue: 0.92, operatingCost: 1.12, credit: 0.82 },
}

export const GAME_EVENT_FREQUENCY_INTERVAL_MULTIPLIERS: Record<GameEventFrequency, number> = {
  CALM: 1.55,
  STANDARD: 1,
  FREQUENT: 0.68,
}

export function createDefaultFreePlaySettings(): GameFreePlaySettings {
  return {
    capitalPreset: 'STANDARD',
    startingCapital: GAME_FREE_PLAY_CAPITALS.STANDARD,
    cheatUnlimitedMoney: false,
    economyProfile: 'STANDARD',
    eventFrequency: 'STANDARD',
    objectivesEnabled: true,
    contextualTipsEnabled: true,
    wikiEnabled: true,
    tutorialEnabled: true,
    fareGuidance: 'GUIDED',
    inspectionGuidance: 'GUIDED',
    regulationGuidance: 'GUIDED',
    graphics: {
      quality: 'BALANCED',
      vehicleAnimations: true,
      buildings2D5: true,
    },
  }
}

export function normalizeCapitalPreset(value: unknown): GameCapitalPreset {
  return ['STANDARD', 'COMFORT', 'RICH', 'CUSTOM'].includes(String(value))
    ? value as GameCapitalPreset
    : 'STANDARD'
}

export function normalizeEconomyProfile(value: unknown): GameEconomyProfile {
  return ['GENEROUS', 'STANDARD', 'HARD'].includes(String(value))
    ? value as GameEconomyProfile
    : 'STANDARD'
}

export function normalizeEventFrequency(value: unknown): GameEventFrequency {
  return ['CALM', 'STANDARD', 'FREQUENT'].includes(String(value))
    ? value as GameEventFrequency
    : 'STANDARD'
}

export function normalizeGraphicsQuality(value: unknown): GameGraphicsQuality {
  return ['ECO', 'BALANCED', 'HIGH'].includes(String(value))
    ? value as GameGraphicsQuality
    : 'BALANCED'
}

export function normalizeFreePlaySettings(value?: Partial<GameFreePlaySettings> | null): GameFreePlaySettings {
  const fallback = createDefaultFreePlaySettings()
  const preset = normalizeCapitalPreset(value?.capitalPreset)
  const presetCapital = preset === 'CUSTOM'
    ? Number(value?.startingCapital)
    : GAME_FREE_PLAY_CAPITALS[preset]
  const startingCapital = Number.isFinite(presetCapital)
    ? Math.min(GAME_FREE_PLAY_CUSTOM_MAX_CAPITAL, Math.max(GAME_FREE_PLAY_CUSTOM_MIN_CAPITAL, Math.round(presetCapital)))
    : fallback.startingCapital

  return {
    capitalPreset: preset,
    startingCapital,
    cheatUnlimitedMoney: preset === 'CUSTOM' && value?.cheatUnlimitedMoney === true,
    economyProfile: normalizeEconomyProfile(value?.economyProfile),
    eventFrequency: normalizeEventFrequency(value?.eventFrequency),
    objectivesEnabled: value?.objectivesEnabled !== false,
    contextualTipsEnabled: value?.contextualTipsEnabled !== false,
    wikiEnabled: value?.wikiEnabled !== false,
    tutorialEnabled: value?.tutorialEnabled !== false,
    fareGuidance: value?.fareGuidance === 'MANUAL' ? 'MANUAL' : 'GUIDED',
    inspectionGuidance: value?.inspectionGuidance === 'MANUAL' ? 'MANUAL' : 'GUIDED',
    regulationGuidance: value?.regulationGuidance === 'MANUAL' ? 'MANUAL' : 'GUIDED',
    graphics: {
      quality: normalizeGraphicsQuality(value?.graphics?.quality),
      vehicleAnimations: value?.graphics?.vehicleAnimations !== false,
      buildings2D5: value?.graphics?.buildings2D5 !== false,
    },
  }
}
